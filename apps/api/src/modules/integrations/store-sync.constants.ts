import type { FulfillmentEvent } from './store-fulfillment';

export const STORE_SYNC_QUEUE = 'store-fulfillment';

export interface StoreSyncJobData {
  shipmentId: string;
  event: FulfillmentEvent;
}

export const STORE_BACKFILL_QUEUE = 'store-backfill';

export interface StoreBackfillJobData {
  storeConnectionId: string;
  /** max orders to pull */
  limit: number;
}
