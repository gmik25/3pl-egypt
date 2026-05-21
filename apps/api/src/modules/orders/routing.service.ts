import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { GovernorateCode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../wms/inventory/inventory.service';

export interface RoutingItem {
  skuId: string;
  quantity: number;
}

/**
 * Smart routing: pick the warehouse that should fulfil an order.
 * EG: prefer a same-governorate warehouse that can actually fulfil the order from available
 * stock; otherwise fall back to a same-governorate warehouse, then any active one.
 * Stock is a *preference*, not a hard gate — orders may be created against zero stock
 * (backorder) and picked once goods arrive.
 */
@Injectable()
export class RoutingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async pickWarehouse(governorate: GovernorateCode, items: RoutingItem[]): Promise<string> {
    const active = await this.prisma.warehouse.findMany({
      where: { isActive: true },
      select: { id: true, governorate: true },
    });
    if (active.length === 0) {
      throw new ServiceUnavailableException('No active warehouse available to route this order');
    }

    const sameGov = active.filter((w) => w.governorate === governorate);
    const candidates = sameGov.length > 0 ? sameGov : active;

    // Prefer a candidate that can fully satisfy every line from available stock.
    for (const w of candidates) {
      if (await this.canFulfil(w.id, items)) return w.id;
    }
    // No fully-stocked candidate — fall back to the preferred candidate (backorder allowed).
    return candidates[0]!.id;
  }

  /** True if the warehouse has enough AVAILABLE stock for every line. */
  async canFulfil(warehouseId: string, items: RoutingItem[]): Promise<boolean> {
    for (const item of items) {
      const available = await this.inventory.availableQty(item.skuId, warehouseId);
      if (available < item.quantity) return false;
    }
    return true;
  }
}
