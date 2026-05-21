import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { assertGovernorateInScope, governorateFilter } from '../../../common/governorate-scope';
import type { AuthenticatedUser } from '../../../common/types/authenticated-request';
import type {
  CreateLocationDto,
  CreateWarehouseDto,
  CreateZoneDto,
  UpdateWarehouseDto,
} from './dto/location-dtos';

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ----- Warehouses -----

  listWarehouses(actor: AuthenticatedUser) {
    return this.prisma.warehouse.findMany({
      where: { governorate: governorateFilter(actor) },
      orderBy: { code: 'asc' },
      include: { _count: { select: { zones: true, locations: true } } },
    });
  }

  async getWarehouse(id: string, actor: AuthenticatedUser) {
    const wh = await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        zones: {
          orderBy: { code: 'asc' },
          include: { _count: { select: { locations: true } } },
        },
      },
    });
    if (!wh) throw new NotFoundException('Warehouse not found');
    assertGovernorateInScope(actor, wh.governorate);
    return wh;
  }

  async createWarehouse(dto: CreateWarehouseDto, actor: AuthenticatedUser) {
    assertGovernorateInScope(actor, dto.governorate);
    const wh = await this.prisma.warehouse.create({ data: { ...dto } });
    await this.audit.record({ userId: actor.id, action: AuditAction.CREATE, entity: 'warehouse', entityId: wh.id, after: { code: wh.code } });
    return wh;
  }

  async updateWarehouse(id: string, dto: UpdateWarehouseDto, actor: AuthenticatedUser) {
    const wh = await this.getWarehouse(id, actor);
    if (dto.governorate) assertGovernorateInScope(actor, dto.governorate);
    const updated = await this.prisma.warehouse.update({ where: { id: wh.id }, data: { ...dto } });
    await this.audit.record({ userId: actor.id, action: AuditAction.UPDATE, entity: 'warehouse', entityId: id, after: { ...dto } });
    return updated;
  }

  // ----- Zones -----

  async createZone(warehouseId: string, dto: CreateZoneDto, actor: AuthenticatedUser) {
    await this.getWarehouse(warehouseId, actor); // scope check + existence
    const zone = await this.prisma.zone.create({
      data: { warehouseId, type: dto.type, code: dto.code, name: dto.name },
    });
    await this.audit.record({ userId: actor.id, action: AuditAction.CREATE, entity: 'zone', entityId: zone.id, after: { code: zone.code } });
    return zone;
  }

  // ----- Locations -----

  async listLocations(warehouseId: string, actor: AuthenticatedUser) {
    await this.getWarehouse(warehouseId, actor);
    return this.prisma.location.findMany({
      where: { warehouseId },
      orderBy: { code: 'asc' },
      include: { zone: { select: { type: true, name: true } } },
    });
  }

  async createLocation(warehouseId: string, dto: CreateLocationDto, actor: AuthenticatedUser) {
    await this.getWarehouse(warehouseId, actor);
    const zone = await this.prisma.zone.findUnique({ where: { id: dto.zoneId } });
    if (!zone || zone.warehouseId !== warehouseId) {
      throw new BadRequestException('Zone does not belong to this warehouse');
    }
    const loc = await this.prisma.location.create({
      data: {
        warehouseId,
        zoneId: dto.zoneId,
        code: dto.code,
        type: dto.type ?? 'BIN',
        barcode: dto.barcode ?? null,
      },
    });
    await this.audit.record({ userId: actor.id, action: AuditAction.CREATE, entity: 'location', entityId: loc.id, after: { code: loc.code } });
    return loc;
  }
}
