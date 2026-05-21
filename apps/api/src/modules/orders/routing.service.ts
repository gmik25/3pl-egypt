import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { GovernorateCode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Smart routing: pick the warehouse that should fulfil an order.
 * EG: prefer a warehouse in the same governorate; otherwise fall back to any active warehouse.
 * Stock-aware routing is stubbed until the WMS module owns inventory — see hasStock().
 */
@Injectable()
export class RoutingService {
  constructor(private readonly prisma: PrismaService) {}

  async pickWarehouse(governorate: GovernorateCode, _skuCodes: string[]): Promise<string> {
    const active = await this.prisma.warehouse.findMany({
      where: { isActive: true },
      select: { id: true, governorate: true },
    });
    if (active.length === 0) {
      throw new ServiceUnavailableException('No active warehouse available to route this order');
    }
    // 1) same-governorate match
    const sameGov = active.find((w) => w.governorate === governorate);
    if (sameGov) return sameGov.id;
    // 2) TODO(WMS): nearest-by-distance + stock availability. For now, first active warehouse.
    return active[0]!.id;
  }

  /** Stubbed stock check — always true until WMS lands. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hasStock(_warehouseId: string, _skuCode: string, _qty: number): boolean {
    return true;
  }
}
