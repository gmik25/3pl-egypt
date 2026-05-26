import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { assertGovernorateInScope, governorateFilter } from '../../../common/governorate-scope';
import type { AuthenticatedUser } from '../../../common/types/authenticated-request';
import type {
  AllocateLocationsDto,
  BulkGenerateLocationsDto,
  CreateLocationDto,
  CreateWarehouseDto,
  CreateZoneDto,
  UpdateWarehouseDto,
} from './dto/location-dtos';

export interface LocationFilters {
  zoneId?: string;
  aisle?: string;
  rack?: string;
  allocatedClientId?: string;
  unallocated?: boolean;
  q?: string;
}

const MAX_BULK_LOCATIONS = 5000;

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

  async listLocations(warehouseId: string, actor: AuthenticatedUser, filters: LocationFilters = {}) {
    await this.getWarehouse(warehouseId, actor);
    const where: Prisma.LocationWhereInput = { warehouseId };
    if (filters.zoneId) where.zoneId = filters.zoneId;
    if (filters.aisle) where.aisle = filters.aisle;
    if (filters.rack) where.rack = filters.rack;
    if (filters.unallocated) where.allocatedClientId = null;
    else if (filters.allocatedClientId) where.allocatedClientId = filters.allocatedClientId;
    if (filters.q) where.code = { contains: filters.q, mode: 'insensitive' };

    const rows = await this.prisma.location.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        zone: { select: { type: true, name: true } },
        allocatedClient: { select: { id: true, legalName: true } },
        stockLevels: { select: { quantity: true } },
      },
      take: 2000,
    });
    // EG: occupancy = any stock in the bin; units = total qty across statuses (for utilisation views).
    return rows.map(({ stockLevels, ...l }) => {
      const units = stockLevels.reduce((s, x) => s + x.quantity, 0);
      return {
        ...l,
        units,
        occupied: units > 0,
        utilizationPct: l.capacityUnits && l.capacityUnits > 0 ? Math.round((units / l.capacityUnits) * 100) : null,
      };
    });
  }

  /** Bulk-generate a storage grid (aisle × rack × level × bin). Existing codes are skipped. */
  async generateLocations(warehouseId: string, dto: BulkGenerateLocationsDto, actor: AuthenticatedUser) {
    await this.getWarehouse(warehouseId, actor);
    const zone = await this.prisma.zone.findUnique({ where: { id: dto.zoneId } });
    if (!zone || zone.warehouseId !== warehouseId) throw new BadRequestException('Zone does not belong to this warehouse');
    if (dto.allocatedClientId) {
      const client = await this.prisma.client.findUnique({ where: { id: dto.allocatedClientId } });
      if (!client) throw new BadRequestException('Allocated client not found');
    }

    const combos: { aisle: string; rack: string; level: string; bin: string }[] = [];
    for (const aisle of dto.aisles)
      for (const rack of dto.racks)
        for (const level of dto.levels)
          for (const bin of dto.bins) combos.push({ aisle, rack, level, bin });

    if (combos.length > MAX_BULK_LOCATIONS) {
      throw new BadRequestException(`Refusing to generate ${combos.length} locations (max ${MAX_BULK_LOCATIONS})`);
    }

    const res = await this.prisma.location.createMany({
      data: combos.map((c) => ({
        warehouseId,
        zoneId: dto.zoneId,
        code: `${c.aisle}-${c.rack}-${c.level}-${c.bin}`,
        type: dto.type ?? 'BIN',
        aisle: c.aisle,
        rack: c.rack,
        level: c.level,
        bin: c.bin,
        capacityUnits: dto.capacityUnits ?? null,
        allocatedClientId: dto.allocatedClientId ?? null,
      })),
      skipDuplicates: true,
    });
    await this.audit.record({ userId: actor.id, action: AuditAction.CREATE, entity: 'location', entityId: warehouseId, after: { generated: res.count, requested: combos.length, zone: zone.code } });
    return { requested: combos.length, created: res.count, skipped: combos.length - res.count };
  }

  /** Allocate (clientId) or release (null) a set of locations to a seller. */
  async allocateLocations(dto: AllocateLocationsDto, actor: AuthenticatedUser) {
    const clientId = dto.clientId ?? null;
    if (clientId) {
      const client = await this.prisma.client.findUnique({ where: { id: clientId } });
      if (!client) throw new BadRequestException('Client not found');
    }
    const locs = await this.prisma.location.findMany({
      where: { id: { in: dto.locationIds } },
      include: { warehouse: { select: { governorate: true } } },
    });
    if (locs.length !== dto.locationIds.length) throw new BadRequestException('Some locations were not found');
    for (const l of locs) assertGovernorateInScope(actor, l.warehouse.governorate);

    const res = await this.prisma.location.updateMany({ where: { id: { in: dto.locationIds } }, data: { allocatedClientId: clientId } });
    await this.audit.record({ userId: actor.id, action: AuditAction.UPDATE, entity: 'location', entityId: clientId ?? 'release', after: { allocatedClientId: clientId, count: res.count } });
    return { updated: res.count, clientId };
  }

  /** Per-seller allocation footprint for a warehouse (locations reserved + how many are occupied). */
  async allocationSummary(warehouseId: string, actor: AuthenticatedUser) {
    await this.getWarehouse(warehouseId, actor);
    const grouped = await this.prisma.location.groupBy({
      by: ['allocatedClientId'],
      where: { warehouseId, allocatedClientId: { not: null } },
      _count: { _all: true },
      _sum: { capacityUnits: true },
    });
    const clients = await this.prisma.client.findMany({
      where: { id: { in: grouped.map((g) => g.allocatedClientId!).filter(Boolean) } },
      select: { id: true, legalName: true },
    });
    const nameById = new Map(clients.map((c) => [c.id, c.legalName]));
    const out = [];
    for (const g of grouped) {
      const occupiedCount = await this.prisma.location.count({
        where: { warehouseId, allocatedClientId: g.allocatedClientId, stockLevels: { some: { quantity: { gt: 0 } } } },
      });
      const stored = await this.prisma.stockLevel.aggregate({
        _sum: { quantity: true },
        where: { location: { warehouseId, allocatedClientId: g.allocatedClientId } },
      });
      const reservedCapacity = g._sum.capacityUnits ?? 0;
      const storedUnits = stored._sum.quantity ?? 0;
      out.push({
        clientId: g.allocatedClientId,
        legalName: nameById.get(g.allocatedClientId!) ?? '—',
        locationCount: g._count._all,
        occupiedCount,
        reservedCapacity,
        storedUnits,
        utilizationPct: reservedCapacity > 0 ? Math.round((storedUnits / reservedCapacity) * 100) : null,
      });
    }
    return out.sort((a, b) => b.locationCount - a.locationCount);
  }

  /** Suggested putaway locations for a seller (their allocated, active STORAGE bins). */
  async suggestLocationsForClient(warehouseId: string, clientId: string, actor: AuthenticatedUser) {
    await this.getWarehouse(warehouseId, actor);
    return this.prisma.location.findMany({
      where: { warehouseId, allocatedClientId: clientId, isActive: true, zone: { type: 'STORAGE' } },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, aisle: true, rack: true, level: true, bin: true },
      take: 200,
    });
  }

  /** Seller self-serve: the signed-in client's allocated locations grouped by warehouse. */
  async myAllocations(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { clientId: true } });
    if (!user.clientId) throw new ForbiddenException('This account is not linked to a client');
    const rows = await this.prisma.location.findMany({
      where: { allocatedClientId: user.clientId },
      orderBy: [{ warehouseId: 'asc' }, { code: 'asc' }],
      include: {
        warehouse: { select: { id: true, code: true, name: true, governorate: true } },
        zone: { select: { type: true } },
        stockLevels: { select: { quantity: true } },
      },
    });
    const byWh = new Map<string, { warehouse: (typeof rows)[number]['warehouse']; locations: { id: string; code: string; zoneType: string; units: number }[] }>();
    for (const l of rows) {
      if (!byWh.has(l.warehouseId)) byWh.set(l.warehouseId, { warehouse: l.warehouse, locations: [] });
      byWh.get(l.warehouseId)!.locations.push({ id: l.id, code: l.code, zoneType: l.zone.type, units: l.stockLevels.reduce((s, x) => s + x.quantity, 0) });
    }
    return Array.from(byWh.values());
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
        capacityUnits: dto.capacityUnits ?? null,
      },
    });
    await this.audit.record({ userId: actor.id, action: AuditAction.CREATE, entity: 'location', entityId: loc.id, after: { code: loc.code } });
    return loc;
  }
}
