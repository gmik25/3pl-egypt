import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, StoreConnectionStatus, StorePlatform } from '@prisma/client';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { IntakeService } from '../orders/intake/intake.service';
import { decryptSecret, encryptSecret, hmacSha256Base64, safeEqual } from '../../common/crypto/secret-box';
import { buildAuthorizeUrl, exchangeCodeForToken, PLATFORM_INTAKE } from './store-oauth';
import type { ConnectStoreDto } from './dto/store-dtos';

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly intake: IntakeService,
  ) {}

  // EG: never return ciphertext — only whether a credential is configured.
  private redact<T extends { accessTokenEncrypted: string | null; webhookSecretEncrypted: string | null; oauthState?: string | null }>(c: T) {
    const { accessTokenEncrypted, webhookSecretEncrypted, oauthState, ...rest } = c;
    return { ...rest, hasAccessToken: !!accessTokenEncrypted, hasWebhookSecret: !!webhookSecretEncrypted };
  }

  /** Strip scheme/path/trailing slash → bare host. */
  private normalizeDomain(raw: string): string {
    return raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }

  async list() {
    const rows = await this.prisma.storeConnection.findMany({
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { id: true, legalName: true } } },
    });
    return rows.map((r) => this.redact(r));
  }

  private clientId(platform: StorePlatform): string {
    return this.config.get<string>(`stores.${platform.toLowerCase()}.clientId`, '');
  }
  private clientSecret(platform: StorePlatform): string {
    return this.config.get<string>(`stores.${platform.toLowerCase()}.clientSecret`, '');
  }
  private redirectUri(platform: StorePlatform): string {
    const base = this.config.get<string>('appPublicUrl', 'http://localhost:3001');
    return `${base}/api/integrations/stores/callback/${platform}`;
  }

  /**
   * Begin onboarding: persist a PENDING connection (with a per-store webhook secret + OAuth state nonce)
   * and return the platform authorize URL. The webhook secret is returned ONCE for manual setups.
   */
  async connect(dto: ConnectStoreDto, actorId: string | null) {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Client not found');

    const shopDomain = this.normalizeDomain(dto.shopDomain);
    const existing = await this.prisma.storeConnection.findUnique({ where: { shopDomain } });
    if (existing && existing.clientId !== dto.clientId) {
      throw new BadRequestException(`${shopDomain} is already linked to another client`);
    }

    const state = randomBytes(16).toString('hex');
    const webhookSecret = randomBytes(24).toString('base64url');

    const conn = await this.prisma.storeConnection.upsert({
      where: { shopDomain },
      update: { platform: dto.platform, status: StoreConnectionStatus.PENDING, oauthState: state },
      create: {
        clientId: dto.clientId,
        platform: dto.platform,
        shopDomain,
        status: StoreConnectionStatus.PENDING,
        oauthState: state,
        webhookSecretEncrypted: encryptSecret(webhookSecret),
      },
    });

    await this.audit.record({ userId: actorId, action: AuditAction.CREATE, entity: 'storeConnection', entityId: conn.id, after: { shopDomain, platform: dto.platform } });

    const authorizeUrl = buildAuthorizeUrl({
      platform: dto.platform,
      shopDomain,
      clientId: this.clientId(dto.platform),
      redirectUri: this.redirectUri(dto.platform),
      state,
    });

    return {
      id: conn.id,
      shopDomain,
      authorizeUrl,
      // returned once so a seller can paste it into a manual webhook config
      webhookSecret: existing ? undefined : webhookSecret,
      simulated: !this.clientId(dto.platform),
    };
  }

  /**
   * OAuth callback: validate the state nonce, exchange the code for a token, store it encrypted,
   * mark the store CONNECTED. Returns the web URL to redirect the merchant's browser to.
   */
  async handleCallback(platform: StorePlatform, query: { code?: string; state?: string; shop?: string }): Promise<string> {
    const web = this.config.get<string>('webPublicUrl', 'http://localhost:5173');
    const fail = (reason: string) => `${web}/integrations/stores?error=${encodeURIComponent(reason)}`;

    if (!query.state) return fail('missing_state');
    const conn = await this.prisma.storeConnection.findFirst({ where: { oauthState: query.state, platform } });
    if (!conn) return fail('unknown_state');
    if (!query.code) return fail('missing_code');

    try {
      const token = await exchangeCodeForToken({
        platform,
        shopDomain: conn.shopDomain,
        code: query.code,
        clientId: this.clientId(platform),
        clientSecret: this.clientSecret(platform),
        redirectUri: this.redirectUri(platform),
      });
      await this.prisma.storeConnection.update({
        where: { id: conn.id },
        data: {
          status: StoreConnectionStatus.CONNECTED,
          accessTokenEncrypted: encryptSecret(token.accessToken),
          scopes: token.scopes,
          oauthState: null,
          installedAt: new Date(),
        },
      });
      await this.audit.record({ userId: null, action: AuditAction.UPDATE, entity: 'storeConnection', entityId: conn.id, after: { status: 'CONNECTED', simulated: token.simulated } });
      return `${web}/integrations/stores?connected=${platform}${token.simulated ? '&simulated=1' : ''}`;
    } catch (e) {
      this.logger.warn(`OAuth callback failed for ${conn.shopDomain}: ${e instanceof Error ? e.message : 'unknown'}`);
      return fail('exchange_failed');
    }
  }

  async disconnect(id: string, actorId: string | null) {
    const conn = await this.prisma.storeConnection.findUnique({ where: { id } });
    if (!conn) throw new NotFoundException('Store connection not found');
    const updated = await this.prisma.storeConnection.update({
      where: { id },
      data: { status: StoreConnectionStatus.REVOKED, accessTokenEncrypted: null, oauthState: null },
    });
    await this.audit.record({ userId: actorId, action: AuditAction.UPDATE, entity: 'storeConnection', entityId: id, after: { status: 'REVOKED' } });
    return this.redact(updated);
  }

  /**
   * Inbound order webhook resolved by store domain. Verifies per-store HMAC, then hands the
   * payload to OMS intake with the resolved client. EG: COD orders flow straight into the pipeline.
   */
  async ingestStoreWebhook(
    platform: StorePlatform,
    shopDomain: string | undefined,
    payload: Record<string, unknown>,
    rawBody?: Buffer,
    signature?: string | null,
  ) {
    if (!shopDomain) throw new BadRequestException('Missing store domain header');
    const domain = this.normalizeDomain(shopDomain);
    const conn = await this.prisma.storeConnection.findUnique({ where: { shopDomain: domain } });
    if (!conn || conn.platform !== platform) throw new NotFoundException('No store connection for this domain');
    if (conn.status !== StoreConnectionStatus.CONNECTED) throw new UnauthorizedException('Store connection is not active');

    if (conn.webhookSecretEncrypted) {
      const secret = decryptSecret(conn.webhookSecretEncrypted);
      const expected = hmacSha256Base64(secret, rawBody ?? Buffer.from(JSON.stringify(payload)));
      if (!signature || !safeEqual(signature, expected)) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    const result = await this.intake.ingestWebhook(PLATFORM_INTAKE[platform], conn.clientId, payload);
    await this.prisma.storeConnection.update({ where: { id: conn.id }, data: { lastEventAt: new Date() } });
    return result;
  }
}
