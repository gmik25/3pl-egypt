import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { AuditAction, PurchaseOrderStatus, StockStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { InspectionResult, type CreatePurchaseOrderDto, type ReceiveLineDto } from './dto/inbound-dtos';

@Injectable()
export class InboundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
  ) {}

  list(warehouseId?: string, status?: PurchaseOrderStatus) {
    return this.prisma.purchaseOrder.findMany({
      where: { warehouseId, status },
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { legalName: true } }, _count: { select: { lines: true } } },
    });
  }

  async getById(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, legalName: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        lines: { include: { sku: { select: { code: true, nameAr: true, expiryTracked: true } } } },
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async create(dto: CreatePurchaseOrderDto, actorId: string | null) {
    const po = await this.prisma.purchaseOrder.create({
      data: {
        reference: `PO-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        clientId: dto.clientId,
        warehouseId: dto.warehouseId,
        supplierName: dto.supplierName ?? null,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        notes: dto.notes ?? null,
        status: PurchaseOrderStatus.CONFIRMED,
        lines: {
          create: dto.lines.map((l) => ({
            skuId: l.skuId,
            quantityOrdered: l.quantityOrdered,
            lotNumber: l.lotNumber ?? null,
            expiryDate: l.expiryDate ? new Date(l.expiryDate) : null,
          })),
        },
      },
      include: { lines: true },
    });
    await this.audit.record({ userId: actorId, action: AuditAction.CREATE, entity: 'purchaseOrder', entityId: po.id, after: { reference: po.reference } });
    return po;
  }

  /**
   * Receive a quantity against a PO line. Inspection result drives stock status:
   * PASS → AVAILABLE, DAMAGED → QUARANTINE (awaiting disposal approval), REJECTED → not stocked.
   * EG: damaged goods are quarantined, not silently added to available stock.
   */
  async receive(dto: ReceiveLineDto, actorId: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const line = await tx.poLine.findUnique({
        where: { id: dto.poLineId },
        include: { purchaseOrder: true },
      });
      if (!line) throw new NotFoundException('PO line not found');
      const remaining = line.quantityOrdered - line.quantityReceived;

      const stocked = dto.inspection !== InspectionResult.REJECTED;
      if (stocked && dto.quantity > remaining) {
        throw new BadRequestException(`Cannot receive ${dto.quantity}; only ${remaining} remaining on this line`);
      }

      if (stocked) {
        const status = dto.inspection === InspectionResult.DAMAGED ? StockStatus.QUARANTINE : StockStatus.AVAILABLE;
        await this.inventory.applyReceipt(
          {
            skuId: line.skuId,
            locationId: dto.locationId,
            quantity: dto.quantity,
            status,
            lotNumber: dto.lotNumber ?? line.lotNumber,
            expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : line.expiryDate,
            purchaseOrderId: line.purchaseOrderId,
            note: dto.note ?? `Receipt (${dto.inspection})`,
          },
          actorId,
          tx,
        );
        await tx.poLine.update({
          where: { id: line.id },
          data: { quantityReceived: { increment: dto.quantity } },
        });
      }

      // Recompute PO status across all lines
      const lines = await tx.poLine.findMany({ where: { purchaseOrderId: line.purchaseOrderId } });
      const allReceived = lines.every((l) => l.quantityReceived >= l.quantityOrdered);
      const anyReceived = lines.some((l) => l.quantityReceived > 0);
      const status = allReceived
        ? PurchaseOrderStatus.RECEIVED
        : anyReceived
          ? PurchaseOrderStatus.PARTIALLY_RECEIVED
          : PurchaseOrderStatus.CONFIRMED;
      await tx.purchaseOrder.update({ where: { id: line.purchaseOrderId }, data: { status } });

      await this.audit.record({
        userId: actorId,
        action: AuditAction.UPDATE,
        entity: 'purchaseOrder',
        entityId: line.purchaseOrderId,
        after: { received: dto.quantity, inspection: dto.inspection, poStatus: status },
      });

      return tx.purchaseOrder.findUniqueOrThrow({
        where: { id: line.purchaseOrderId },
        include: { lines: true },
      });
    });
  }
}
