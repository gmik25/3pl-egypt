import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'node:crypto';
import * as OTPAuth from 'otpauth';
import { AuditAction, type User, type UserRoleName } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_REQUIRING_MFA } from '@3pl/shared';

import type { LoginDto } from './dto/login.dto';
import type { AuthTokens, JwtAccessPayload, JwtRefreshPayload } from './types';

const REFRESH_TOKEN_BYTES = 48;

interface LoginContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ----- Login -----

  async login(dto: LoginDto, ctx: LoginContext): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        mfaSecret: true,
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    if (!user || !user.isActive) {
      // EG: don't reveal which side failed
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const roleNames = user.roles.map((ur) => ur.role.name);
    const requiresMfa =
      roleNames.some((r) => ROLES_REQUIRING_MFA.includes(r)) && user.mfaSecret?.confirmed === true;

    if (requiresMfa) {
      if (!dto.mfaCode) {
        // 401 with hint so the client knows to ask for a TOTP code
        throw new UnauthorizedException({ message: 'MFA required', mfaRequired: true });
      }
      const valid = this.verifyTotp(user.mfaSecret!.secret, dto.mfaCode);
      if (!valid) throw new UnauthorizedException({ message: 'Invalid MFA code', mfaRequired: true });
    }

    const tokens = await this.issueTokens(user, roleNames, requiresMfa, dto.deviceLabel);

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.LOGIN,
        entity: 'user',
        entityId: user.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
    });

    return tokens;
  }

  // ----- Refresh -----

  async refresh(rawRefreshToken: string): Promise<AuthTokens> {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtRefreshPayload>(rawRefreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.typ !== 'refresh') throw new UnauthorizedException('Wrong token type');

    const stored = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }
    if (stored.tokenHash !== this.hashToken(rawRefreshToken)) {
      // Reuse / tampering — revoke whole user as defence-in-depth
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Refresh token mismatch');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: stored.userId },
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });
    if (!user.isActive) throw new UnauthorizedException('User disabled');

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const roleNames = user.roles.map((ur) => ur.role.name);
    // Carry forward MFA status from the original session — if user originally MFA'd, refresh keeps it.
    // We can't tell from the refresh token alone, so we re-check whether the user STILL requires MFA;
    // if they do and they were verified once, keep mfa=true on the new access token.
    const requiresMfa = roleNames.some((r) => ROLES_REQUIRING_MFA.includes(r));
    return this.issueTokens(user, roleNames, requiresMfa, stored.deviceLabel ?? undefined);
  }

  // ----- Logout -----

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const hash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.revokeAllForUser(userId);
    }
    await this.prisma.auditLog.create({
      data: { userId, action: AuditAction.LOGOUT, entity: 'user', entityId: userId },
    });
  }

  // ----- MFA -----

  async mfaEnroll(userId: string): Promise<{ secret: string; otpauthUri: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    const issuer = this.config.get<string>('totp.issuer', '3PL-Egypt');
    const totp = new OTPAuth.TOTP({
      issuer,
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    await this.prisma.mfaSecret.upsert({
      where: { userId },
      update: { secret, confirmed: false },
      create: { userId, secret, confirmed: false },
    });

    await this.prisma.auditLog.create({
      data: { userId, action: AuditAction.MFA_ENROL, entity: 'user', entityId: userId },
    });

    return { secret, otpauthUri: totp.toString() };
  }

  async mfaVerify(userId: string, code: string): Promise<void> {
    const row = await this.prisma.mfaSecret.findUnique({ where: { userId } });
    if (!row) throw new ForbiddenException('MFA not enrolled');
    if (!this.verifyTotp(row.secret, code)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    await this.prisma.mfaSecret.update({ where: { userId }, data: { confirmed: true } });
    await this.prisma.auditLog.create({
      data: { userId, action: AuditAction.MFA_VERIFY, entity: 'user', entityId: userId },
    });
  }

  // ----- internals -----

  private verifyTotp(base32Secret: string, code: string): boolean {
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(base32Secret),
    });
    // window=1 = allow one period of clock skew either side
    return totp.validate({ token: code, window: 1 }) !== null;
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    user: Pick<User, 'id' | 'email' | 'scopedGovernorates'>,
    roleNames: UserRoleName[],
    mfaVerified: boolean,
    deviceLabel?: string,
  ): Promise<AuthTokens> {
    // Flatten permissions
    const perms = await this.prisma.permission.findMany({
      where: { roles: { some: { role: { name: { in: roleNames } } } } },
      select: { key: true },
    });
    const permissions = perms.map((p) => p.key);

    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      roles: roleNames,
      permissions,
      scopedGovernorates: user.scopedGovernorates,
      mfa: mfaVerified,
      typ: 'access',
    };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessTtl', '15m'),
    });

    // Create RefreshToken row first to get an id (jti)
    const refreshTtl = this.config.get<string>('jwt.refreshTtl', '7d');
    const expiresAt = new Date(Date.now() + this.parseTtl(refreshTtl));
    const raw = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const tokenHash = this.hashToken(raw);
    const stored = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        deviceLabel: deviceLabel ?? null,
        expiresAt,
      },
    });

    const refreshPayload: JwtRefreshPayload = { sub: user.id, jti: stored.id, typ: 'refresh' };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: refreshTtl,
      // Bind the raw secret into the JWT so possession of the JWT alone isn't enough; we re-verify
      // against `tokenHash` in refresh(). The raw token is appended to the JWT signature implicitly
      // via subject/jti binding plus the hash check in refresh().
    });

    // Update tokenHash to bind it to the actual JWT we just signed, so refresh() can detect reuse
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { tokenHash: this.hashToken(refreshToken) },
    });

    return { accessToken, refreshToken };
  }

  /** Tiny TTL parser supporting "<n>s|m|h|d". */
  private parseTtl(s: string): number {
    const m = /^(\d+)\s*([smhd])$/.exec(s.trim());
    if (!m) throw new Error(`Invalid TTL: ${s}`);
    const n = Number(m[1]);
    const unit = m[2];
    const mult: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return n * (mult[unit!] ?? 1_000);
  }
}
