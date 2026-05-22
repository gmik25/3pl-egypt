import { Injectable } from '@nestjs/common';
import { CodLedgerType, OrderState, type GovernorateCode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface DateRange {
  from: Date;
  to: Date;
}

// EG: headline on-time SLA — Greater Cairo + Alexandria 2 days, rest 4. Per-contract SLA overrides
// are honoured in the Client module; the dashboard KPI uses these defaults for a single number.
const FAST_GOVS: GovernorateCode[] = ['C', 'GZ', 'ALX', 'KB'] as GovernorateCode[];
const FAST_DAYS = 2;
const OTHER_DAYS = 4;
const DAY_MS = 86_400_000;

function pct(num: number, den: number): number {
  return den === 0 ? 0 : Math.round((num / den) * 10_000) / 100;
}

@Injectable()
export class ReportingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ops KPIs: fulfilment, on-time delivery, COD collection, state breakdown. */
  async opsKpis(range: DateRange) {
    const where = { createdAt: { gte: range.from, lte: range.to } };

    const byState = await this.prisma.order.groupBy({ by: ['state'], where, _count: { _all: true } });
    const stateCounts = Object.fromEntries(byState.map((s) => [s.state, s._count._all])) as Record<OrderState, number>;
    const total = byState.reduce((s, r) => s + r._count._all, 0);
    const delivered = stateCounts.DELIVERED ?? 0;

    // COD expected vs collected (within the range)
    const codExpectedAgg = await this.prisma.order.aggregate({
      _sum: { codAmountPiastres: true },
      where: { ...where, paymentMethod: 'COD' },
    });
    const codCollectedAgg = await this.prisma.codLedgerEntry.aggregate({
      _sum: { amountPiastres: true },
      where: { type: CodLedgerType.COLLECTED, createdAt: { gte: range.from, lte: range.to } },
    });
    const codExpected = codExpectedAgg._sum.codAmountPiastres ?? 0;
    const codCollected = codCollectedAgg._sum.amountPiastres ?? 0;

    // On-time delivery — compare each delivered order's DELIVERED transition vs created + SLA days.
    const deliveredOrders = await this.prisma.order.findMany({
      where: { ...where, state: OrderState.DELIVERED },
      select: {
        createdAt: true,
        governorate: true,
        transitions: { where: { toState: OrderState.DELIVERED }, select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      take: 2000,
    });
    let onTime = 0;
    let measured = 0;
    for (const o of deliveredOrders) {
      const dt = o.transitions[0]?.createdAt;
      if (!dt) continue;
      measured++;
      const slaDays = FAST_GOVS.includes(o.governorate) ? FAST_DAYS : OTHER_DAYS;
      if (dt.getTime() - o.createdAt.getTime() <= slaDays * DAY_MS) onTime++;
    }

    return {
      range,
      totalOrders: total,
      stateCounts,
      fulfilmentRatePct: pct(delivered, total),
      failedOrders: stateCounts.FAILED ?? 0,
      returnedOrders: stateCounts.RETURNED ?? 0,
      onTimeDeliveryPct: pct(onTime, measured),
      onTimeMeasured: measured,
      codExpectedPiastres: codExpected,
      codCollectedPiastres: codCollected,
      codCollectionRatePct: pct(codCollected, codExpected),
    };
  }

  /** Commission revenue per client (3PL fees) within the range. */
  async revenuePerClient(range: DateRange) {
    const grouped = await this.prisma.walletEntry.groupBy({
      by: ['walletId'],
      where: { type: 'COMMISSION_FEE', createdAt: { gte: range.from, lte: range.to } },
      _sum: { amountPiastres: true },
    });
    const wallets = await this.prisma.clientWallet.findMany({
      where: { id: { in: grouped.map((g) => g.walletId) } },
      select: { id: true, client: { select: { legalName: true } } },
    });
    const nameByWallet = new Map(wallets.map((w) => [w.id, w.client.legalName]));
    return grouped
      .map((g) => ({ client: nameByWallet.get(g.walletId) ?? '—', revenuePiastres: Math.abs(g._sum.amountPiastres ?? 0) }))
      .sort((a, b) => b.revenuePiastres - a.revenuePiastres);
  }

  /** Courier performance scorecard within the range. */
  async courierScorecard(range: DateRange) {
    const shipments = await this.prisma.shipment.findMany({
      where: { carrierType: 'COURIER', createdAt: { gte: range.from, lte: range.to } },
      select: { status: true, attemptCount: true, courierAccount: { select: { code: true } } },
    });
    const map = new Map<string, { courier: string; total: number; delivered: number; failed: number; returned: number; attempts: number }>();
    for (const s of shipments) {
      const k = s.courierAccount?.code ?? 'UNKNOWN';
      const row = map.get(k) ?? { courier: k, total: 0, delivered: 0, failed: 0, returned: 0, attempts: 0 };
      row.total++;
      row.attempts += s.attemptCount;
      if (s.status === 'DELIVERED') row.delivered++;
      else if (s.status === 'RETURNED') row.returned++;
      else if (s.status === 'FAILED') row.failed++;
      map.set(k, row);
    }
    return [...map.values()].map((r) => ({
      courier: r.courier,
      shipments: r.total,
      delivered: r.delivered,
      failed: r.failed,
      returned: r.returned,
      deliveryRatePct: pct(r.delivered, r.total),
      avgAttempts: r.total ? Math.round((r.attempts / r.total) * 100) / 100 : 0,
    }));
  }

  /** Storage utilisation proxy — total units in stock per warehouse, by status. */
  async inventoryByWarehouse() {
    const warehouses = await this.prisma.warehouse.findMany({ select: { id: true, code: true, name: true } });
    const out = [];
    for (const w of warehouses) {
      const agg = await this.prisma.stockLevel.groupBy({
        by: ['status'],
        where: { location: { warehouseId: w.id } },
        _sum: { quantity: true },
      });
      const byStatus = Object.fromEntries(agg.map((a) => [a.status, a._sum.quantity ?? 0]));
      out.push({
        warehouse: `${w.name} (${w.code})`,
        availableUnits: byStatus.AVAILABLE ?? 0,
        quarantineUnits: byStatus.QUARANTINE ?? 0,
        damagedUnits: byStatus.DAMAGED ?? 0,
      });
    }
    return out;
  }
}
