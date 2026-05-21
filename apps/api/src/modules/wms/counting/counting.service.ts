import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, CycleCountStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class CountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
  ) {}

  list(warehouseId?: string, status?: CycleCountStatus) {
    return this.prisma.cycleCount.findMany({
      where: { warehouseId, status },
      orderBy: { createdAt: 'desc' },
      include: { sku: { select: { code: true, nameAr: true } } },
    });
  }

  /** Open a count for a SKU at a location — snapshots the current expected (AVAILABLE) quantity. */
  async open(warehouseId: string, locationId: string, skuId: string, actorId: string | null) {
    const expectedQty = await this.inventory.availableAtLocation(skuId, locationId);
    const count = await this.prisma.cycleCount.create({
      data: { warehouseId, locationId, skuId, expectedQty, status: CycleCountStatus.OPEN },
    });
    await this.audit.record({ userId: actorId, action: AuditAction.CREATE, entity: 'cycleCount', entityId: count.id, after: { skuId, locationId, expectedQty } });
    return count;
  }

  /** Record the physical count; computes variance. */
  async recordCount(id: string, countedQty: number, actorId: string | null) {
    const count = await this.prisma.cycleCount.findUnique({ where: { id } });
    if (!count) throw new NotFoundException('Cycle count not found');
    if (count.status === CycleCountStatus.RECONCILED) throw new BadRequestException('Already reconciled');
    const varianceQty = countedQty - count.expectedQty;
    return this.prisma.cycleCount.update({
      where: { id },
      data: { countedQty, varianceQty, status: CycleCountStatus.COUNTED, countedById: actorId },
    });
  }

  /** Post the variance as a stock adjustment and close the count. */
  async reconcile(id: string, actorId: string | null) {
    const count = await this.prisma.cycleCount.findUnique({ where: { id } });
    if (!count) throw new NotFoundException('Cycle count not found');
    if (count.status !== CycleCountStatus.COUNTED || count.varianceQty == null) {
      throw new BadRequestException('Record a count before reconciling');
    }
    if (count.varianceQty !== 0) {
      await this.inventory.countAdjust(count.skuId, count.locationId, count.varianceQty, actorId);
    }
    const updated = await this.prisma.cycleCount.update({
      where: { id },
      data: { status: CycleCountStatus.RECONCILED, reconciledAt: new Date() },
    });
    await this.audit.record({ userId: actorId, action: AuditAction.UPDATE, entity: 'cycleCount', entityId: id, after: { variance: count.varianceQty, status: 'RECONCILED' } });
    return updated;
  }
}
