import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MovementType,
  StockStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { AdjustStockDto, ChangeStatusDto, TransferStockDto } from './dto/inventory-dtos';

type Tx = Prisma.TransactionClient | PrismaClient;

export interface ReceiptInput {
  skuId: string;
  locationId: string;
  quantity: number;
  status: StockStatus;
  lotNumber?: string | null;
  expiryDate?: Date | null;
  orderId?: string | null;
  purchaseOrderId?: string | null;
  note?: string | null;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------- queries ----------

  stockBySku(skuId: string) {
    return this.prisma.stockLevel.findMany({
      where: { skuId },
      include: {
        location: { select: { code: true, warehouseId: true, zone: { select: { type: true } } } },
        lot: { select: { lotNumber: true, expiryDate: true } },
      },
      orderBy: { quantity: 'desc' },
    });
  }

  stockByLocation(locationId: string) {
    return this.prisma.stockLevel.findMany({
      where: { locationId },
      include: { sku: { select: { code: true, nameAr: true } }, lot: true },
    });
  }

  /** Total AVAILABLE quantity for a SKU, optionally scoped to one warehouse. Used by OMS routing. */
  async availableQty(skuId: string, warehouseId?: string): Promise<number> {
    const agg = await this.prisma.stockLevel.aggregate({
      _sum: { quantity: true },
      where: {
        skuId,
        status: StockStatus.AVAILABLE,
        location: warehouseId ? { warehouseId } : undefined,
      },
    });
    return agg._sum.quantity ?? 0;
  }

  /** FEFO ordering: AVAILABLE stock for a SKU in a warehouse, soonest-expiry first (no-expiry last). */
  async fefo(skuId: string, warehouseId: string) {
    const levels = await this.prisma.stockLevel.findMany({
      where: { skuId, status: StockStatus.AVAILABLE, quantity: { gt: 0 }, location: { warehouseId } },
      include: { location: { select: { code: true } }, lot: { select: { lotNumber: true, expiryDate: true } } },
    });
    return levels.sort((a, b) => {
      const ax = a.lot?.expiryDate?.getTime() ?? Number.POSITIVE_INFINITY;
      const bx = b.lot?.expiryDate?.getTime() ?? Number.POSITIVE_INFINITY;
      return ax - bx;
    });
  }

  /** SKUs at or below their reorder point (by total AVAILABLE), optionally per warehouse. */
  async lowStock(warehouseId?: string) {
    const skus = await this.prisma.sku.findMany({
      where: { isActive: true, reorderPointQty: { gt: 0 } },
      select: { id: true, code: true, nameAr: true, reorderPointQty: true, clientId: true },
    });
    const out: { skuId: string; code: string; nameAr: string; available: number; reorderPointQty: number }[] = [];
    for (const s of skus) {
      const available = await this.availableQty(s.id, warehouseId);
      if (available <= s.reorderPointQty) {
        out.push({ skuId: s.id, code: s.code, nameAr: s.nameAr, available, reorderPointQty: s.reorderPointQty });
      }
    }
    return out;
  }

  // ---------- mutations ----------

  async adjust(dto: AdjustStockDto, actorId: string | null) {
    const status = dto.status ?? StockStatus.AVAILABLE;
    return this.prisma.$transaction(async (tx) => {
      const warehouseId = await this.locationWarehouse(tx, dto.locationId);
      const lotId = await this.resolveLot(tx, dto.skuId, dto.lotNumber, dto.expiryDate);
      await this.addStock(tx, { skuId: dto.skuId, locationId: dto.locationId, lotId, status, delta: dto.deltaQty });
      await this.writeMovement(tx, {
        warehouseId,
        skuId: dto.skuId,
        lotId,
        toLocationId: dto.deltaQty > 0 ? dto.locationId : null,
        fromLocationId: dto.deltaQty < 0 ? dto.locationId : null,
        quantity: Math.abs(dto.deltaQty),
        type: MovementType.ADJUSTMENT,
        status,
        actorId,
        note: dto.note ?? null,
      });
      await this.audit.record({ userId: actorId, action: 'UPDATE', entity: 'stock', entityId: dto.skuId, after: { locationId: dto.locationId, deltaQty: dto.deltaQty, status } });
      return this.stockByLocation(dto.locationId);
    });
  }

  async transfer(dto: TransferStockDto, actorId: string | null) {
    if (dto.fromLocationId === dto.toLocationId) throw new BadRequestException('from and to locations are equal');
    const status = dto.status ?? StockStatus.AVAILABLE;
    return this.prisma.$transaction(async (tx) => {
      const warehouseId = await this.locationWarehouse(tx, dto.fromLocationId);
      await this.addStock(tx, { skuId: dto.skuId, locationId: dto.fromLocationId, lotId: dto.lotId ?? null, status, delta: -dto.quantity });
      await this.addStock(tx, { skuId: dto.skuId, locationId: dto.toLocationId, lotId: dto.lotId ?? null, status, delta: dto.quantity });
      await this.writeMovement(tx, {
        warehouseId,
        skuId: dto.skuId,
        lotId: dto.lotId ?? null,
        fromLocationId: dto.fromLocationId,
        toLocationId: dto.toLocationId,
        quantity: dto.quantity,
        type: MovementType.TRANSFER,
        status,
        actorId,
      });
      return this.stockBySku(dto.skuId);
    });
  }

  async changeStatus(dto: ChangeStatusDto, actorId: string | null) {
    if (dto.fromStatus === dto.toStatus) throw new BadRequestException('fromStatus equals toStatus');
    const type =
      dto.toStatus === StockStatus.QUARANTINE
        ? MovementType.QUARANTINE
        : dto.fromStatus === StockStatus.QUARANTINE && dto.toStatus === StockStatus.AVAILABLE
          ? MovementType.RELEASE
          : MovementType.ADJUSTMENT;
    return this.prisma.$transaction(async (tx) => {
      const warehouseId = await this.locationWarehouse(tx, dto.locationId);
      await this.addStock(tx, { skuId: dto.skuId, locationId: dto.locationId, lotId: dto.lotId ?? null, status: dto.fromStatus, delta: -dto.quantity });
      await this.addStock(tx, { skuId: dto.skuId, locationId: dto.locationId, lotId: dto.lotId ?? null, status: dto.toStatus, delta: dto.quantity });
      await this.writeMovement(tx, {
        warehouseId,
        skuId: dto.skuId,
        lotId: dto.lotId ?? null,
        fromLocationId: dto.locationId,
        toLocationId: dto.locationId,
        quantity: dto.quantity,
        type,
        status: dto.toStatus,
        actorId,
        note: dto.note ?? null,
      });
      await this.audit.record({ userId: actorId, action: 'UPDATE', entity: 'stock', entityId: dto.skuId, after: { from: dto.fromStatus, to: dto.toStatus, qty: dto.quantity } });
      return this.stockByLocation(dto.locationId);
    });
  }

  /** Used by inbound receiving + cycle-count reconcile. Runs inside a caller transaction when provided. */
  async applyReceipt(input: ReceiptInput, actorId: string | null, txArg?: Tx) {
    const run = async (tx: Tx) => {
      const warehouseId = await this.locationWarehouse(tx, input.locationId);
      const lotId = await this.resolveLot(tx, input.skuId, input.lotNumber ?? null, input.expiryDate ?? null);
      await this.addStock(tx, { skuId: input.skuId, locationId: input.locationId, lotId, status: input.status, delta: input.quantity });
      await this.writeMovement(tx, {
        warehouseId,
        skuId: input.skuId,
        lotId,
        toLocationId: input.locationId,
        fromLocationId: null,
        quantity: input.quantity,
        type: MovementType.RECEIPT,
        status: input.status,
        actorId,
        orderId: input.orderId ?? null,
        purchaseOrderId: input.purchaseOrderId ?? null,
        note: input.note ?? null,
      });
    };
    if (txArg) return run(txArg);
    return this.prisma.$transaction((tx) => run(tx));
  }

  movementsForSku(skuId: string, limit = 50) {
    return this.prisma.stockMovement.findMany({
      where: { skuId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Available qty for a SKU at a single location (cycle-count expected snapshot). */
  async availableAtLocation(skuId: string, locationId: string): Promise<number> {
    const agg = await this.prisma.stockLevel.aggregate({
      _sum: { quantity: true },
      where: { skuId, locationId, status: StockStatus.AVAILABLE },
    });
    return agg._sum.quantity ?? 0;
  }

  /** Post a cycle-count variance as a COUNT_ADJUST movement against AVAILABLE stock at a location. */
  async countAdjust(skuId: string, locationId: string, deltaQty: number, actorId: string | null) {
    if (deltaQty === 0) return;
    await this.prisma.$transaction(async (tx) => {
      const warehouseId = await this.locationWarehouse(tx, locationId);
      await this.addStock(tx, { skuId, locationId, lotId: null, status: StockStatus.AVAILABLE, delta: deltaQty });
      await this.writeMovement(tx, {
        warehouseId,
        skuId,
        lotId: null,
        fromLocationId: deltaQty < 0 ? locationId : null,
        toLocationId: deltaQty > 0 ? locationId : null,
        quantity: Math.abs(deltaQty),
        type: MovementType.COUNT_ADJUST,
        status: StockStatus.AVAILABLE,
        actorId,
        note: 'Cycle count reconcile',
      });
    });
  }

  /** Remove quarantined stock (e.g. approved disposal of damaged returns). */
  async dispose(skuId: string, locationId: string, quantity: number, actorId: string | null) {
    await this.prisma.$transaction(async (tx) => {
      const warehouseId = await this.locationWarehouse(tx, locationId);
      await this.addStock(tx, { skuId, locationId, lotId: null, status: StockStatus.QUARANTINE, delta: -quantity });
      await this.writeMovement(tx, {
        warehouseId,
        skuId,
        lotId: null,
        fromLocationId: locationId,
        toLocationId: null,
        quantity,
        type: MovementType.DISPOSAL,
        status: StockStatus.QUARANTINE,
        actorId,
        note: 'Disposal of damaged stock',
      });
    });
  }

  // ---------- internals ----------

  private async locationWarehouse(tx: Tx, locationId: string): Promise<string> {
    const loc = await tx.location.findUnique({ where: { id: locationId }, select: { warehouseId: true } });
    if (!loc) throw new NotFoundException('Location not found');
    return loc.warehouseId;
  }

  private async resolveLot(tx: Tx, skuId: string, lotNumber?: string | null, expiryDate?: Date | string | null): Promise<string | null> {
    if (!lotNumber) return null;
    const lot = await tx.lot.upsert({
      where: { skuId_lotNumber: { skuId, lotNumber } },
      update: expiryDate ? { expiryDate: new Date(expiryDate) } : {},
      create: { skuId, lotNumber, expiryDate: expiryDate ? new Date(expiryDate) : null },
      select: { id: true },
    });
    return lot.id;
  }

  private async addStock(
    tx: Tx,
    p: { skuId: string; locationId: string; lotId: string | null; status: StockStatus; delta: number },
  ) {
    const existing = await tx.stockLevel.findFirst({
      where: { skuId: p.skuId, locationId: p.locationId, lotId: p.lotId, status: p.status },
    });
    if (existing) {
      const newQty = existing.quantity + p.delta;
      if (newQty < 0) throw new BadRequestException('Insufficient stock at location');
      if (newQty === 0) await tx.stockLevel.delete({ where: { id: existing.id } });
      else await tx.stockLevel.update({ where: { id: existing.id }, data: { quantity: newQty } });
    } else {
      if (p.delta < 0) throw new BadRequestException('No stock to remove at location');
      await tx.stockLevel.create({
        data: { skuId: p.skuId, locationId: p.locationId, lotId: p.lotId, status: p.status, quantity: p.delta },
      });
    }
  }

  private async writeMovement(
    tx: Tx,
    m: {
      warehouseId: string;
      skuId: string;
      lotId: string | null;
      fromLocationId: string | null;
      toLocationId: string | null;
      quantity: number;
      type: MovementType;
      status: StockStatus;
      actorId: string | null;
      orderId?: string | null;
      purchaseOrderId?: string | null;
      note?: string | null;
    },
  ) {
    await tx.stockMovement.create({
      data: {
        warehouseId: m.warehouseId,
        skuId: m.skuId,
        lotId: m.lotId,
        fromLocationId: m.fromLocationId,
        toLocationId: m.toLocationId,
        quantity: m.quantity,
        type: m.type,
        status: m.status,
        actorId: m.actorId,
        orderId: m.orderId ?? null,
        purchaseOrderId: m.purchaseOrderId ?? null,
        note: m.note ?? null,
      },
    });
  }
}
