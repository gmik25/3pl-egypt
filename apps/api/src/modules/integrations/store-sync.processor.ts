import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { StoreConnectionStatus, StoreSyncStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { decryptSecret } from '../../common/crypto/secret-box';
import { pushFulfillment } from './store-fulfillment';
import { STORE_SYNC_QUEUE, type StoreSyncJobData } from './store-sync.constants';

@Processor(STORE_SYNC_QUEUE)
export class StoreFulfillmentProcessor extends WorkerHost {
  private readonly logger = new Logger(StoreFulfillmentProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<StoreSyncJobData>): Promise<void> {
    const { shipmentId, event } = job.data;

    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        courierAccount: { select: { name: true } },
        order: {
          select: {
            externalRef: true,
            storeConnection: { select: { platform: true, shopDomain: true, status: true, accessTokenEncrypted: true } },
          },
        },
      },
    });
    if (!shipment) return; // shipment was deleted — nothing to push

    const conn = shipment.order.storeConnection;
    const pushable = conn && conn.status === StoreConnectionStatus.CONNECTED && conn.accessTokenEncrypted && shipment.order.externalRef;
    if (!pushable) {
      // CSV/manual order, or the store was disconnected — record that there's nothing to sync.
      if (shipment.storeSyncStatus !== StoreSyncStatus.NOT_APPLICABLE) {
        await this.prisma.shipment.update({ where: { id: shipmentId }, data: { storeSyncStatus: StoreSyncStatus.NOT_APPLICABLE } });
      }
      return;
    }

    // Idempotency: a fulfillment already created for this shipment — don't duplicate on re-dispatch.
    if (event === 'DISPATCHED' && shipment.storeFulfillmentId) return;

    await this.prisma.shipment.update({ where: { id: shipmentId }, data: { storeSyncStatus: StoreSyncStatus.PENDING } });

    try {
      const accessToken = decryptSecret(conn!.accessTokenEncrypted!);
      const result = await pushFulfillment({
        platform: conn!.platform,
        shopDomain: conn!.shopDomain,
        accessToken,
        externalOrderId: shipment.order.externalRef!,
        trackingNumber: shipment.trackingNumber,
        courierName: shipment.courierAccount?.name ?? null,
        event,
        existingFulfillmentId: shipment.storeFulfillmentId,
      });
      await this.prisma.shipment.update({
        where: { id: shipmentId },
        data: {
          storeSyncStatus: StoreSyncStatus.SYNCED,
          storeFulfillmentId: result.fulfillmentId,
          storeSyncedAt: new Date(),
          storeSyncError: result.note ?? null,
        },
      });
      this.logger.log(`fulfillment ${event} synced for shipment ${shipmentId} (${result.simulated ? 'simulated' : 'live'})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      await this.prisma.shipment.update({ where: { id: shipmentId }, data: { storeSyncStatus: StoreSyncStatus.FAILED, storeSyncError: msg } });
      throw e; // surface to BullMQ → retry with exponential backoff
    }
  }
}
