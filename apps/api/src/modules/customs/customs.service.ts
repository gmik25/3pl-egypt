import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { AuditAction, ImportStatus, StockStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../wms/inventory/inventory.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { computeLandedCost } from './landed-cost';
import type { CreateImportShipmentDto, HsCodeDto } from './dto/customs-dtos';

@Injectable()
export class CustomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
    private readonly config: ConfigService,
  ) {}

  // ---- HS codes ----

  listHsCodes(search?: string) {
    return this.prisma.hsCode.findMany({
      where: search ? { OR: [{ code: { contains: search } }, { description: { contains: search, mode: 'insensitive' } }] } : undefined,
      orderBy: { code: 'asc' },
    });
  }

  async upsertHsCode(dto: HsCodeDto, actorId: string | null) {
    const hs = await this.prisma.hsCode.upsert({
      where: { code: dto.code },
      update: { description: dto.description, dutyRateBps: dto.dutyRateBps },
      create: { code: dto.code, description: dto.description, dutyRateBps: dto.dutyRateBps },
    });
    await this.audit.record({ userId: actorId, action: AuditAction.UPDATE, entity: 'hsCode', entityId: hs.id, after: { code: hs.code, dutyRateBps: hs.dutyRateBps } });
    return hs;
  }

  // ---- Import shipments ----

  listShipments(status?: ImportStatus, clientId?: string) {
    return this.prisma.importShipment.findMany({
      where: { status, clientId },
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { legalName: true } }, _count: { select: { lines: true } } },
      take: 200,
    });
  }

  async getShipment(id: string) {
    const s = await this.prisma.importShipment.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, legalName: true } },
        warehouse: { select: { id: true, code: true, name: true, isBonded: true } },
        lines: { include: { sku: { select: { code: true, nameAr: true } } } },
      },
    });
    if (!s) throw new NotFoundException('Import shipment not found');
    return s;
  }

  async create(dto: CreateImportShipmentDto, actor: AuthenticatedUser) {
    // Resolve HS code + duty rate per line (line override → SKU's hsCode → reject if absent).
    const lineData = [];
    for (const l of dto.lines) {
      const sku = await this.prisma.sku.findUnique({ where: { id: l.skuId }, select: { hsCode: true } });
      if (!sku) throw new BadRequestException(`SKU ${l.skuId} not found`);
      const hsCode = l.hsCode ?? sku.hsCode;
      if (!hsCode) throw new BadRequestException(`No HS code for SKU ${l.skuId} (set one on the SKU or the line)`);
      const tariff = await this.prisma.hsCode.findUnique({ where: { code: hsCode } });
      lineData.push({
        skuId: l.skuId,
        hsCode,
        dutyRateBps: tariff?.dutyRateBps ?? 0,
        quantity: l.quantity,
        unitCostPiastres: l.unitCostPiastres,
      });
    }

    const shipment = await this.prisma.importShipment.create({
      data: {
        reference: `IMP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        clientId: dto.clientId,
        warehouseId: dto.warehouseId ?? null,
        originCountry: dto.originCountry ?? null,
        supplierName: dto.supplierName ?? null,
        freightCostPiastres: dto.freightCostPiastres ?? 0,
        insuranceCostPiastres: dto.insuranceCostPiastres ?? 0,
        bonded: dto.bonded ?? false,
        lines: { create: lineData },
      },
      include: { lines: true },
    });
    await this.audit.record({ userId: actor.id, action: AuditAction.CREATE, entity: 'importShipment', entityId: shipment.id, after: { reference: shipment.reference } });
    return shipment;
  }

  async declare(id: string, ecaDeclarationNumber: string, actor: AuthenticatedUser) {
    await this.requireStatus(id, ImportStatus.DRAFT);
    const s = await this.prisma.importShipment.update({
      where: { id },
      data: { status: ImportStatus.DECLARED, ecaDeclarationNumber, declaredAt: new Date() },
    });
    await this.audit.record({ userId: actor.id, action: AuditAction.UPDATE, entity: 'importShipment', entityId: id, after: { status: 'DECLARED', ecaDeclarationNumber } });
    return s;
  }

  async inspect(id: string, actor: AuthenticatedUser) {
    await this.requireStatus(id, ImportStatus.DECLARED);
    return this.transition(id, ImportStatus.UNDER_INSPECTION, actor);
  }

  async clear(id: string, actor: AuthenticatedUser) {
    await this.requireStatus(id, ImportStatus.UNDER_INSPECTION);
    const s = await this.prisma.importShipment.update({ where: { id }, data: { status: ImportStatus.CLEARED, clearedAt: new Date() } });
    await this.audit.record({ userId: actor.id, action: AuditAction.UPDATE, entity: 'importShipment', entityId: id, after: { status: 'CLEARED' } });
    return s;
  }

  /** Release cleared goods into warehouse stock. */
  async release(id: string, locationId: string, actor: AuthenticatedUser) {
    const s = await this.prisma.importShipment.findUnique({ where: { id }, include: { lines: true } });
    if (!s) throw new NotFoundException('Import shipment not found');
    if (s.status !== ImportStatus.CLEARED) throw new BadRequestException(`Must be CLEARED to release (is ${s.status})`);

    for (const line of s.lines) {
      await this.inventory.applyReceipt(
        { skuId: line.skuId, locationId, quantity: line.quantity, status: StockStatus.AVAILABLE, note: `Import ${s.reference}` },
        actor.id,
      );
    }
    const updated = await this.prisma.importShipment.update({ where: { id }, data: { status: ImportStatus.RELEASED, releasedAt: new Date() } });
    await this.audit.record({ userId: actor.id, action: AuditAction.UPDATE, entity: 'importShipment', entityId: id, after: { status: 'RELEASED' } });
    return updated;
  }

  async landedCost(id: string) {
    const s = await this.getShipment(id);
    const vatBps = this.config.get<number>('vatRateBps', 1400);
    const cost = computeLandedCost(
      s.lines.map((l) => ({ ref: l.sku.code, quantity: l.quantity, unitCostPiastres: l.unitCostPiastres, dutyRateBps: l.dutyRateBps })),
      s.freightCostPiastres,
      s.insuranceCostPiastres,
      vatBps,
    );
    // EG: bonded goods defer duty + VAT until release.
    return { ...cost, bonded: s.bonded, dutyDeferred: s.bonded && s.status !== ImportStatus.RELEASED };
  }

  private async transition(id: string, status: ImportStatus, actor: AuthenticatedUser) {
    const s = await this.prisma.importShipment.update({ where: { id }, data: { status } });
    await this.audit.record({ userId: actor.id, action: AuditAction.UPDATE, entity: 'importShipment', entityId: id, after: { status } });
    return s;
  }

  private async requireStatus(id: string, status: ImportStatus) {
    const s = await this.prisma.importShipment.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Import shipment not found');
    if (s.status !== status) throw new BadRequestException(`Must be ${status} (is ${s.status})`);
    return s;
  }
}
