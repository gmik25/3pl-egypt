import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import {
  AuditAction,
  ReturnDisposition,
  ReturnReason,
  ReturnStatus,
  StockStatus,
} from '@prisma/client';
import { applyVat } from '@3pl/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../wms/inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import type { InspectItemDto, ReturnItemInputDto } from './dto/returns-dtos';

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
  ) {}

  list(status?: ReturnStatus, clientId?: string) {
    return this.prisma.returnRequest.findMany({
      where: { status, clientId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { reference: true, customerName: true } },
        client: { select: { legalName: true } },
        _count: { select: { items: true } },
      },
      take: 200,
    });
  }

  async getById(id: string) {
    const r = await this.prisma.returnRequest.findUnique({
      where: { id },
      include: {
        order: { select: { reference: true, customerName: true, customerPhone: true, governorate: true, warehouseId: true, state: true } },
        client: { select: { id: true, legalName: true } },
        items: { include: { sku: { select: { code: true, nameAr: true } } } },
        creditNote: { include: { lines: true } },
      },
    });
    if (!r) throw new NotFoundException('Return not found');
    return r;
  }

  /** Public portal: look up a delivered order's returnable items by reference + phone. */
  async lookupForPortal(reference: string, phone: string) {
    const order = await this.prisma.order.findUnique({
      where: { reference },
      include: { items: { include: { sku: { select: { code: true, nameAr: true } } } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerPhone.replace(/\D/g, '') !== (phone ?? '').replace(/\D/g, '')) {
      throw new BadRequestException('Phone does not match the order');
    }
    if (order.state !== 'DELIVERED') throw new BadRequestException('Only delivered orders can be returned');
    return {
      orderReference: order.reference,
      customerName: order.customerName,
      items: order.items.map((i) => ({ skuId: i.skuId, code: i.sku.code, nameAr: i.sku.nameAr, quantity: i.quantity })),
    };
  }

  // ---- creation ----

  async createFromPortal(orderReference: string, customerPhone: string, reason: ReturnReason, customerNote: string | undefined, items: ReturnItemInputDto[]) {
    const order = await this.prisma.order.findUnique({ where: { reference: orderReference }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    // EG: light verification — the requester must know the order reference + the phone on the order.
    if (order.customerPhone.replace(/\D/g, '') !== customerPhone.replace(/\D/g, '')) {
      throw new BadRequestException('Phone does not match the order');
    }
    if (order.state !== 'DELIVERED') {
      throw new BadRequestException('Only delivered orders can be returned');
    }
    return this.persistReturn(order, reason, customerNote, items, null);
  }

  async createAdmin(orderId: string, reason: ReturnReason, customerNote: string | undefined, items: ReturnItemInputDto[], actor: AuthenticatedUser) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    return this.persistReturn(order, reason, customerNote, items, actor.id);
  }

  private async persistReturn(
    order: { id: string; clientId: string; items: { skuId: string; quantity: number; unitPricePiastres: number }[] },
    reason: ReturnReason,
    customerNote: string | undefined,
    items: ReturnItemInputDto[],
    actorId: string | null,
  ) {
    const lines = items.map((req) => {
      const orderItem = order.items.find((oi) => oi.skuId === req.skuId);
      if (!orderItem) throw new BadRequestException(`SKU ${req.skuId} is not on this order`);
      if (req.quantity > orderItem.quantity) {
        throw new BadRequestException(`Cannot return ${req.quantity}; only ${orderItem.quantity} were ordered`);
      }
      return { skuId: req.skuId, quantity: req.quantity, unitPricePiastres: orderItem.unitPricePiastres };
    });

    const ret = await this.prisma.returnRequest.create({
      data: {
        rmaNumber: `RMA-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        orderId: order.id,
        clientId: order.clientId,
        reason,
        customerNote: customerNote ?? null,
        items: { create: lines },
      },
      include: { items: true },
    });
    await this.audit.record({ userId: actorId, action: AuditAction.CREATE, entity: 'returnRequest', entityId: ret.id, after: { rmaNumber: ret.rmaNumber, reason } });
    return ret;
  }

  // ---- lifecycle ----

  async approve(id: string, actor: AuthenticatedUser) {
    const r = await this.requireStatus(id, ReturnStatus.REQUESTED);
    const updated = await this.prisma.returnRequest.update({ where: { id }, data: { status: ReturnStatus.APPROVED, approvedById: actor.id } });
    await this.audit.record({ userId: actor.id, action: AuditAction.UPDATE, entity: 'returnRequest', entityId: id, after: { status: 'APPROVED' } });
    return updated;
  }

  async reject(id: string, actor: AuthenticatedUser) {
    const r = await this.prisma.returnRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Return not found');
    if (r.status === ReturnStatus.CLOSED) throw new BadRequestException('Return is closed');
    const updated = await this.prisma.returnRequest.update({ where: { id }, data: { status: ReturnStatus.REJECTED } });
    await this.audit.record({ userId: actor.id, action: AuditAction.UPDATE, entity: 'returnRequest', entityId: id, after: { status: 'REJECTED' } });
    return updated;
  }

  async markReceived(id: string, actor: AuthenticatedUser) {
    await this.requireStatus(id, ReturnStatus.APPROVED);
    const updated = await this.prisma.returnRequest.update({ where: { id }, data: { status: ReturnStatus.RECEIVED, receivedAt: new Date() } });
    await this.audit.record({ userId: actor.id, action: AuditAction.UPDATE, entity: 'returnRequest', entityId: id, after: { status: 'RECEIVED' } });
    return updated;
  }

  /** Disposition one item: resellable → back to AVAILABLE stock, damaged → QUARANTINE. */
  async inspectItem(returnItemId: string, dto: InspectItemDto, actor: AuthenticatedUser) {
    const item = await this.prisma.returnItem.findUnique({ where: { id: returnItemId }, include: { returnRequest: true } });
    if (!item) throw new NotFoundException('Return item not found');
    if (item.returnRequest.status !== ReturnStatus.RECEIVED) {
      throw new BadRequestException('Return must be RECEIVED before inspection');
    }
    const status = dto.disposition === ReturnDisposition.RESELLABLE ? StockStatus.AVAILABLE : StockStatus.QUARANTINE;
    await this.inventory.applyReceipt(
      { skuId: item.skuId, locationId: dto.restockLocationId, quantity: item.quantity, status, note: `Return ${item.returnRequest.rmaNumber} (${dto.disposition})` },
      actor.id,
    );
    const updated = await this.prisma.returnItem.update({
      where: { id: returnItemId },
      data: { disposition: dto.disposition, restockLocationId: dto.restockLocationId },
    });
    await this.audit.record({ userId: actor.id, action: AuditAction.UPDATE, entity: 'returnItem', entityId: returnItemId, after: { disposition: dto.disposition } });
    return updated;
  }

  async markInspected(id: string, actor: AuthenticatedUser) {
    const r = await this.prisma.returnRequest.findUnique({ where: { id }, include: { items: true } });
    if (!r) throw new NotFoundException('Return not found');
    if (r.status !== ReturnStatus.RECEIVED) throw new BadRequestException(`Return is ${r.status}`);
    if (r.items.some((i) => !i.disposition)) throw new BadRequestException('All items must be inspected first');
    const updated = await this.prisma.returnRequest.update({ where: { id }, data: { status: ReturnStatus.INSPECTED, inspectedAt: new Date() } });
    await this.audit.record({ userId: actor.id, action: AuditAction.UPDATE, entity: 'returnRequest', entityId: id, after: { status: 'INSPECTED' } });
    return updated;
  }

  /** Approve disposal of a damaged item → removes it from quarantine. */
  async approveDisposal(returnItemId: string, actor: AuthenticatedUser) {
    const item = await this.prisma.returnItem.findUnique({ where: { id: returnItemId } });
    if (!item) throw new NotFoundException('Return item not found');
    if (item.disposition !== ReturnDisposition.DAMAGED || !item.restockLocationId) {
      throw new BadRequestException('Only inspected damaged items can be disposed');
    }
    if (item.disposalApproved) throw new BadRequestException('Already disposed');
    await this.inventory.dispose(item.skuId, item.restockLocationId, item.quantity, actor.id);
    const updated = await this.prisma.returnItem.update({ where: { id: returnItemId }, data: { disposalApproved: true } });
    await this.audit.record({ userId: actor.id, action: AuditAction.UPDATE, entity: 'returnItem', entityId: returnItemId, after: { disposalApproved: true } });
    return updated;
  }

  /** Close: generate the credit note and mark the order RETURNED. */
  async close(id: string, actor: AuthenticatedUser) {
    const r = await this.prisma.returnRequest.findUnique({ where: { id }, include: { items: { include: { sku: true } }, creditNote: true, order: { select: { state: true } } } });
    if (!r) throw new NotFoundException('Return not found');
    if (r.status !== ReturnStatus.INSPECTED) throw new BadRequestException(`Return must be INSPECTED to close (is ${r.status})`);

    const vatBps = this.config.get<number>('vatRateBps', 1400);
    await this.prisma.$transaction(async (tx) => {
      if (!r.creditNote) {
        const lines = r.items.map((i) => {
          const net = i.unitPricePiastres * i.quantity;
          const { vat, gross } = applyVat(net, vatBps);
          return {
            description: `${i.sku.nameAr} (${i.sku.code}) ×${i.quantity}`,
            quantity: i.quantity,
            unitNetPiastres: i.unitPricePiastres,
            netPiastres: net,
            vatPiastres: vat,
            grossPiastres: gross,
          };
        });
        const net = lines.reduce((s, l) => s + l.netPiastres, 0);
        const vat = lines.reduce((s, l) => s + l.vatPiastres, 0);
        await tx.creditNote.create({
          data: {
            reference: `CN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
            returnRequestId: id,
            clientId: r.clientId,
            netPiastres: net,
            vatPiastres: vat,
            grossPiastres: net + vat,
            lines: { create: lines },
          },
        });
      }
      await tx.returnRequest.update({ where: { id }, data: { status: ReturnStatus.CLOSED, closedAt: new Date() } });
    });

    // Mark the order returned (DELIVERED → RETURNED), if not already.
    if (r.order.state === 'DELIVERED') {
      await this.orders.transition(r.orderId, 'RETURNED', `Return ${r.rmaNumber} closed`, actor);
    }
    await this.audit.record({ userId: actor.id, action: AuditAction.UPDATE, entity: 'returnRequest', entityId: id, after: { status: 'CLOSED' } });
    return this.getById(id);
  }

  private async requireStatus(id: string, status: ReturnStatus) {
    const r = await this.prisma.returnRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Return not found');
    if (r.status !== status) throw new BadRequestException(`Return must be ${status} (is ${r.status})`);
    return r;
  }
}
