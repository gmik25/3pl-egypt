import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditAction, type GovernorateCode, type Prisma, type UserRoleName } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

const USER_PUBLIC_FIELDS = {
  id: true,
  email: true,
  phone: true,
  fullName: true,
  isActive: true,
  scopedGovernorates: true,
  clientId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export interface ListUsersQuery {
  role?: UserRoleName;
  governorate?: GovernorateCode;
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListUsersQuery) {
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 25));
    const where: Prisma.UserWhereInput = {
      isActive: q.isActive,
      roles: q.role ? { some: { role: { name: q.role } } } : undefined,
      scopedGovernorates: q.governorate ? { has: q.governorate } : undefined,
      OR: q.search
        ? [
            { email: { contains: q.search, mode: 'insensitive' } },
            { fullName: { contains: q.search, mode: 'insensitive' } },
            { phone: { contains: q.search } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          ...USER_PUBLIC_FIELDS,
          roles: { include: { role: { select: { name: true } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...USER_PUBLIC_FIELDS,
        roles: { include: { role: { select: { id: true, name: true } } } },
        mfaSecret: { select: { confirmed: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto, actorId: string | null) {
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          phone: dto.phone ?? null,
          passwordHash,
          fullName: dto.fullName,
          isActive: dto.isActive ?? true,
          scopedGovernorates: dto.scopedGovernorates ?? [],
          clientId: dto.clientId ?? null,
        },
        select: USER_PUBLIC_FIELDS,
      });
      if (dto.roles?.length) {
        for (const roleName of dto.roles) {
          const role = await tx.role.findUnique({ where: { name: roleName } });
          if (!role) throw new BadRequestException(`Unknown role: ${roleName}`);
          await tx.userRole.create({ data: { userId: u.id, roleId: role.id } });
        }
      }
      return u;
    });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entity: 'user',
      entityId: user.id,
      after: { email: user.email, fullName: user.fullName, roles: dto.roles ?? [] },
    });
    return this.getById(user.id);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string | null) {
    const before = await this.prisma.user.findUnique({
      where: { id },
      select: USER_PUBLIC_FIELDS,
    });
    if (!before) throw new NotFoundException('User not found');

    const data: Prisma.UserUpdateInput = {
      phone: dto.phone,
      fullName: dto.fullName,
      isActive: dto.isActive,
      scopedGovernorates: dto.scopedGovernorates,
    };
    if (dto.password) {
      data.passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
      // Force re-login on every device when password changes
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: USER_PUBLIC_FIELDS,
    });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entity: 'user',
      entityId: id,
      before: before as unknown as Prisma.InputJsonValue,
      after: updated as unknown as Prisma.InputJsonValue,
    });
    return this.getById(id);
  }

  async deactivate(id: string, actorId: string | null) {
    const before = await this.prisma.user.findUnique({ where: { id }, select: { isActive: true } });
    if (!before) throw new NotFoundException('User not found');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { isActive: false } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.record({
      userId: actorId,
      action: AuditAction.DELETE,
      entity: 'user',
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive: false },
    });
  }

  async assignRole(userId: string, roleName: UserRoleName, actorId: string | null) {
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new BadRequestException(`Unknown role: ${roleName}`);
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entity: 'user',
      entityId: userId,
      after: { addedRole: roleName },
    });
  }

  async revokeRole(userId: string, roleId: string, actorId: string | null) {
    await this.prisma.userRole
      .delete({ where: { userId_roleId: { userId, roleId } } })
      .catch(() => {
        /* idempotent */
      });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entity: 'user',
      entityId: userId,
      after: { removedRoleId: roleId },
    });
  }
}
