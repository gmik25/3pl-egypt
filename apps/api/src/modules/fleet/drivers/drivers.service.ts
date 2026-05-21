import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, type GovernorateCode } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { RegisterDriverDto, UpdateDriverDto } from './dto/driver-dtos';

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(governorate?: GovernorateCode, availableOnly?: boolean) {
    return this.prisma.driverProfile.findMany({
      where: {
        isAvailable: availableOnly ? true : undefined,
        zones: governorate ? { has: governorate } : undefined,
      },
      include: { user: { select: { id: true, fullName: true, phone: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async register(dto: RegisterDriverDto, actorId: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    const isDriver = user.roles.some((r) => r.role.name === 'DRIVER');
    if (!isDriver) throw new BadRequestException('User must have the DRIVER role');

    const profile = await this.prisma.driverProfile.upsert({
      where: { userId: dto.userId },
      update: { vehicleType: dto.vehicleType, plateNumber: dto.plateNumber, zones: dto.zones ?? [] },
      create: {
        userId: dto.userId,
        vehicleType: dto.vehicleType ?? null,
        plateNumber: dto.plateNumber ?? null,
        zones: dto.zones ?? [],
      },
    });
    await this.audit.record({ userId: actorId, action: AuditAction.CREATE, entity: 'driverProfile', entityId: profile.id, after: { userId: dto.userId } });
    return profile;
  }

  async update(userId: string, dto: UpdateDriverDto, actorId: string | null) {
    const existing = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (!existing) throw new NotFoundException('Driver profile not found');
    const profile = await this.prisma.driverProfile.update({
      where: { userId },
      data: {
        vehicleType: dto.vehicleType,
        plateNumber: dto.plateNumber,
        isAvailable: dto.isAvailable,
        zones: dto.zones,
      },
    });
    await this.audit.record({ userId: actorId, action: AuditAction.UPDATE, entity: 'driverProfile', entityId: profile.id, after: { ...dto } });
    return profile;
  }
}
