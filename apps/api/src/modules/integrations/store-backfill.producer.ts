import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { STORE_BACKFILL_QUEUE, type StoreBackfillJobData } from './store-sync.constants';

@Injectable()
export class StoreBackfillProducer {
  private readonly logger = new Logger(StoreBackfillProducer.name);

  constructor(@InjectQueue(STORE_BACKFILL_QUEUE) private readonly queue: Queue<StoreBackfillJobData>) {}

  /** Queue a one-time historical order pull for a freshly connected store. Fire-and-forget. */
  async enqueueBackfill(storeConnectionId: string, limit = 50) {
    try {
      await this.queue.add(
        'backfill',
        { storeConnectionId, limit },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 50, removeOnFail: 100 },
      );
    } catch (e) {
      this.logger.warn(`enqueue backfill failed for ${storeConnectionId}: ${e instanceof Error ? e.message : e}`);
    }
  }
}
