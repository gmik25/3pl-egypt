import { ForbiddenException, Injectable } from '@nestjs/common';
import { CodLedgerType, OrderState, type Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../wms/inventory/inventory.service';
import { WalletService } from '../finance/wallet.service';
import { ReportingService } from '../reporting/reporting.service';

const DAY_MS = 86_400_000;

function emptyStateCounts(): Record<OrderState, number> {
  return { PENDING: 0, PICKED: 0, PACKED: 0, DISPATCHED: 0, DELIVERED: 0, FAILED: 0, RETURNED: 0 };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly wallet: WalletService,
    private readonly reporting: ReportingService,
  ) {}

  // ---------- Customer self-service dashboard (ownership-scoped) ----------

  async portalSummary(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { clientId: true } });
    if (!user.clientId) throw new ForbiddenException('This account is not linked to a client');
    const clientId = user.clientId;

    const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { id: true, legalName: true } });

    const byState = await this.prisma.order.groupBy({ by: ['state'], where: { clientId }, _count: { _all: true } });
    const ordersByState = emptyStateCounts();
    for (const r of byState) ordersByState[r.state] = r._count._all;
    const totalOrders = Object.values(ordersByState).reduce((a, b) => a + b, 0);

    const [codExpected, codCollected, walletId] = await Promise.all([
      this.prisma.order.aggregate({ _sum: { codAmountPiastres: true }, where: { clientId, paymentMethod: 'COD' } }),
      this.prisma.codLedgerEntry.aggregate({ _sum: { amountPiastres: true }, where: { type: CodLedgerType.COLLECTED, order: { clientId } } }),
      this.prisma.clientWallet.findUnique({ where: { clientId }, select: { balancePiastres: true } }),
    ]);

    const returnsOpen = await this.prisma.returnRequest.count({ where: { clientId, status: { in: ['REQUESTED', 'APPROVED', 'RECEIVED', 'INSPECTED'] } } });
    const returnsTotal = await this.prisma.returnRequest.count({ where: { clientId } });

    // Low-stock SKUs for this client
    const skus = await this.prisma.sku.findMany({ where: { clientId, isActive: true, reorderPointQty: { gt: 0 } }, select: { id: true, code: true, nameAr: true, reorderPointQty: true } });
    const lowStock: { code: string; nameAr: string; available: number; reorderPointQty: number }[] = [];
    for (const s of skus) {
      const available = await this.inventory.availableQty(s.id);
      if (available <= s.reorderPointQty) lowStock.push({ code: s.code, nameAr: s.nameAr, available, reorderPointQty: s.reorderPointQty });
    }

    const recentInvoices = await this.prisma.invoice.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { reference: true, grossPiastres: true, status: true, periodEnd: true },
    });

    return {
      client,
      totalOrders,
      ordersByState,
      cod: {
        expectedPiastres: codExpected._sum.codAmountPiastres ?? 0,
        collectedPiastres: codCollected._sum.amountPiastres ?? 0,
        walletBalancePiastres: walletId?.balancePiastres ?? 0,
      },
      returns: { open: returnsOpen, total: returnsTotal },
      lowStock,
      recentInvoices,
    };
  }

  // ---------- Super-admin operations command center ----------

  async opsOverview() {
    const now = Date.now();
    const today = new Date(now - DAY_MS);
    const week = new Date(now - 7 * DAY_MS);

    const [activeClients, warehouses, drivers, openOrders] = await Promise.all([
      this.prisma.client.count({ where: { isActive: true } }),
      this.prisma.warehouse.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, isBonded: true } }),
      this.prisma.driverProfile.count(),
      this.prisma.order.count({ where: { state: { in: ['PENDING', 'PICKED', 'PACKED', 'DISPATCHED'] } } }),
    ]);

    const byStateAll = await this.prisma.order.groupBy({ by: ['state'], _count: { _all: true } });
    const ordersByState = emptyStateCounts();
    for (const r of byStateAll) ordersByState[r.state] = r._count._all;

    const [todayOrders, weekOrders] = await Promise.all([
      this.prisma.order.count({ where: { createdAt: { gte: today } } }),
      this.prisma.order.count({ where: { createdAt: { gte: week } } }),
    ]);

    // COD collected (all-time) + wallet liability (money held for clients)
    const [codCollected, walletSum] = await Promise.all([
      this.prisma.codLedgerEntry.aggregate({ _sum: { amountPiastres: true }, where: { type: CodLedgerType.COLLECTED } }),
      this.prisma.clientWallet.aggregate({ _sum: { balancePiastres: true } }),
    ]);

    // Pending action queues
    const [returnsPending, remittancesPending, importsInFlight, shipmentsOut, failedShipments] = await Promise.all([
      this.prisma.returnRequest.count({ where: { status: { in: ['REQUESTED', 'RECEIVED', 'INSPECTED'] } } }),
      this.prisma.driverRemittance.count({ where: { status: 'PENDING' } }),
      this.prisma.importShipment.count({ where: { status: { in: ['DRAFT', 'DECLARED', 'UNDER_INSPECTION', 'CLEARED'] } } }),
      this.prisma.shipment.count({ where: { status: 'OUT_FOR_DELIVERY' } }),
      this.prisma.shipment.count({ where: { status: 'FAILED' } }),
    ]);

    // Per-warehouse: order count + available units
    const warehouseRows = [];
    for (const w of warehouses) {
      const [orders, stock] = await Promise.all([
        this.prisma.order.count({ where: { warehouseId: w.id } }),
        this.prisma.stockLevel.aggregate({ _sum: { quantity: true }, where: { status: 'AVAILABLE', location: { warehouseId: w.id } } }),
      ]);
      warehouseRows.push({ code: w.code, name: w.name, isBonded: w.isBonded, orders, availableUnits: stock._sum.quantity ?? 0 });
    }

    const range = { from: new Date(now - 30 * DAY_MS), to: new Date(now) };
    const couriers = await this.reporting.courierScorecard(range);

    // Active alerts (counts)
    const low = await this.inventory.lowStock();
    const openOps = await this.prisma.order.findMany({ where: { state: { in: ['PENDING', 'PICKED', 'PACKED', 'DISPATCHED'] } }, select: { governorate: true, createdAt: true }, take: 3000 });
    const fast = ['C', 'GZ', 'ALX', 'KB'];
    const slaBreaches = openOps.filter((o) => now - o.createdAt.getTime() > (fast.includes(o.governorate) ? 2 : 4) * DAY_MS).length;
    const failedSpike = await this.prisma.shipment.count({ where: { status: { in: ['FAILED', 'RETURNED'] }, updatedAt: { gte: today } } });

    return {
      totals: { activeClients, warehouses: warehouses.length, drivers, openOrders, todayOrders, weekOrders },
      ordersByState,
      cod: { collectedPiastres: codCollected._sum.amountPiastres ?? 0, walletLiabilityPiastres: walletSum._sum.balancePiastres ?? 0 },
      queues: { returnsPending, remittancesPending, importsInFlight, shipmentsOut, failedShipments },
      warehouses: warehouseRows,
      couriers,
      alerts: { lowStock: low.length, slaBreaches, failedSpike },
    };
  }
}
