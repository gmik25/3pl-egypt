import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { STORE_SYNC_QUEUE, type StoreSyncJobData } from './store-sync.constants';
import type { FulfillmentEvent } from './store-fulfillment';

@Injectable()
export class StoreSyncProducer {
  private readonly logger = new Logger(StoreSyncProducer.name);

  constructor(@InjectQueue(STORE_SYNC_QUEUE) private readonly queue: Queue<StoreSyncJobData>) {}

  /**
   * Queue an outbound fulfillment push. EG: fire-and-forget — a queue/Redis hiccup must never
   * block the delivery flow; the ops resync endpoint can recover a missed push.
   */
  async enqueueFulfillment(shipmentId: string, event: FulfillmentEvent) {
    try {
      await this.queue.add(
        'fulfill',
        { shipmentId, event },
        { attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100, removeOnFail: 500 },
      );
    } catch (e) {
      this.logger.warn(`enqueue fulfillment failed for ${shipmentId} (${event}): ${e instanceof Error ? e.message : e}`);
    }
  }
}
