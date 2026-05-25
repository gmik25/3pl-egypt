import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { OrdersModule } from '../orders/orders.module';
import { STORE_BACKFILL_QUEUE, STORE_SYNC_QUEUE } from './store-sync.constants';
import { StoreSyncProducer } from './store-sync.producer';
import { StoreFulfillmentProcessor } from './store-sync.processor';
import { StoreBackfillProducer } from './store-backfill.producer';
import { StoreBackfillProcessor } from './store-backfill.processor';

/**
 * Store sync queues. Outbound: push fulfillment/tracking to the platform (fleet lifecycle).
 * Inbound: backfill historical orders on connect (delegates to OMS IntakeService).
 * Producers are exported; the processors run in-process.
 */
@Module({
  imports: [
    OrdersModule, // backfill processor ingests pulled orders via IntakeService
    BullModule.registerQueue({ name: STORE_SYNC_QUEUE }, { name: STORE_BACKFILL_QUEUE }),
  ],
  providers: [StoreSyncProducer, StoreFulfillmentProcessor, StoreBackfillProducer, StoreBackfillProcessor],
  exports: [StoreSyncProducer, StoreBackfillProducer],
})
export class StoreSyncModule {}
