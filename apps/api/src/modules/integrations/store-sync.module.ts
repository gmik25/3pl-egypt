import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { STORE_SYNC_QUEUE } from './store-sync.constants';
import { StoreSyncProducer } from './store-sync.producer';
import { StoreFulfillmentProcessor } from './store-sync.processor';

/**
 * Outbound store fulfillment sync queue. Producer is exported for lifecycle hooks (fleet);
 * the processor runs in-process and pushes fulfillment/tracking back to the e-commerce platform.
 */
@Module({
  imports: [BullModule.registerQueue({ name: STORE_SYNC_QUEUE })],
  providers: [StoreSyncProducer, StoreFulfillmentProcessor],
  exports: [StoreSyncProducer],
})
export class StoreSyncModule {}
