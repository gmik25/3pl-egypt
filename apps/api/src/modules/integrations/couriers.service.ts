import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { encryptSecret } from '../../common/crypto/secret-box';
import type { CreateCourierDto, SetCoverageDto, UpdateCourierDto } from './dto/courier-dtos';

@Injectable()
export class CouriersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // EG: never return ciphertext — expose only whether a credential is configured.
  private redact<T extends { apiKeyEncrypted: string | null; webhookSecretEncrypted: string | null }>(c: T) {
    const { apiKeyEncrypted, webhookSecretEncrypted, ...rest } = c;
    return { ...rest, hasApiKey: !!apiKeyEncrypted, hasWebhookSecret: !!webhookSecretEncrypted };
  }

  async list() {
    const couriers = await this.prisma.courierAccount.findMany({
      orderBy: { code: 'asc' },
      include: { _count: { select: { coverage: true, shipments: true } } },
    });
    return couriers.map((c) => this.redact(c));
  }

  async getById(id: string) {
    const c = await this.prisma.courierAccount.findUnique({
      where: { id },
      include: { coverage: { orderBy: { governorate: 'asc' } } },
    });
    if (!c) throw new NotFoundException('Courier not found');
    return this.redact(c);
  }

  async create(dto: CreateCourierDto, actorId: string | null) {
    const exists = await this.prisma.courierAccount.findUnique({ where: { code: dto.code } });
    if (exists) throw new BadRequestException(`Courier code ${dto.code} already exists`);
    const c = await this.prisma.courierAccount.create({
      data: {
        code: dto.code,
        name: dto.name,
        apiBaseUrl: dto.apiBaseUrl ?? null,
        apiKeyEncrypted: dto.apiKey ? encryptSecret(dto.apiKey) : null,
        webhookSecretEncrypted: dto.webhookSecret ? encryptSecret(dto.webhookSecret) : null,
      },
    });
    await this.audit.record({ userId: actorId, action: AuditAction.CREATE, entity: 'courierAccount', entityId: c.id, after: { code: c.code } });
    return this.redact(c);
  }

  async update(id: string, dto: UpdateCourierDto, actorId: string | null) {
    const existing = await this.prisma.courierAccount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Courier not found');
    const c = await this.prisma.courierAccount.update({
      where: { id },
      data: {
        name: dto.name,
        apiBaseUrl: dto.apiBaseUrl,
        isActive: dto.isActive,
        // empty string = leave unchanged; a value = rotate (encrypt)
        apiKeyEncrypted: dto.apiKey ? encryptSecret(dto.apiKey) : undefined,
        webhookSecretEncrypted: dto.webhookSecret ? encryptSecret(dto.webhookSecret) : undefined,
      },
    });
    await this.audit.record({ userId: actorId, action: AuditAction.UPDATE, entity: 'courierAccount', entityId: id, after: { rotatedApiKey: !!dto.apiKey, rotatedWebhookSecret: !!dto.webhookSecret } });
    return this.redact(c);
  }

  async setCoverage(id: string, dto: SetCoverageDto, actorId: string | null) {
    const c = await this.prisma.courierAccount.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Courier not found');
    for (const e of dto.entries) {
      await this.prisma.courierCoverage.upsert({
        where: { courierId_governorate: { courierId: id, governorate: e.governorate } },
        update: { etaDays: e.etaDays, isServiceable: e.isServiceable ?? true },
        create: { courierId: id, governorate: e.governorate, etaDays: e.etaDays, isServiceable: e.isServiceable ?? true },
      });
    }
    await this.audit.record({ userId: actorId, action: AuditAction.UPDATE, entity: 'courierAccount', entityId: id, after: { coverageEntries: dto.entries.length } });
    return this.getById(id);
  }

  /** Stubbed connectivity check. EG: replace with a real ping to the courier's API. */
  async testConnection(id: string) {
    const c = await this.prisma.courierAccount.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Courier not found');
    return {
      ok: true,
      courier: c.code,
      apiBaseUrl: c.apiBaseUrl ?? null,
      hasCredentials: !!c.apiKeyEncrypted,
      note: 'Stubbed — wire a real API ping per courier.',
    };
  }
}
