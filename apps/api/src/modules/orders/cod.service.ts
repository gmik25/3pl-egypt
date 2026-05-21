import { Injectable, NotFoundException } from '@nestjs/common';
import { CodLedgerType, type Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Lightweight COD ledger for OMS. Full reconciliation (driver remittance,
 * client wallet credit) belongs to the COD & Finance module; here we record
 * collection/remittance events per order and expose a per-order + summary view.
 */
@Injectable()
export class CodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async addEntry(
    orderId: string,
    type: CodLedgerType,
    amountPiastres: number,
    actorId: string | null,
    note?: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) throw new NotFoundException('Order not found');
    const entry = await this.prisma.codLedgerEntry.create({
      data: { orderId, type, amountPiastres, actorId, note: note ?? null },
    });
    await this.audit.record({
      userId: actorId,
      action: 'CREATE',
      entity: 'codLedgerEntry',
      entityId: entry.id,
      after: { orderId, type, amountPiastres },
    });
    return entry;
  }

  listForOrder(orderId: string) {
    return this.prisma.codLedgerEntry.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Aggregate COD position across orders, optionally filtered by client. */
  async summary(clientId?: string) {
    const where: Prisma.CodLedgerEntryWhereInput = clientId
      ? { order: { clientId } }
      : {};
    const grouped = await this.prisma.codLedgerEntry.groupBy({
      by: ['type'],
      where,
      _sum: { amountPiastres: true },
    });
    const byType: Record<string, number> = {};
    for (const g of grouped) byType[g.type] = g._sum.amountPiastres ?? 0;
    const collected = byType[CodLedgerType.COLLECTED] ?? 0;
    const remitted = byType[CodLedgerType.REMITTED] ?? 0;
    const adjustments = byType[CodLedgerType.ADJUSTMENT] ?? 0;
    return {
      collectedPiastres: collected,
      remittedPiastres: remitted,
      adjustmentsPiastres: adjustments,
      outstandingPiastres: collected + adjustments - remitted,
    };
  }
}
