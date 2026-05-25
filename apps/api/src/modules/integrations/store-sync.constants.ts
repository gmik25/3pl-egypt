import type { FulfillmentEvent } from './store-fulfillment';

export const STORE_SYNC_QUEUE = 'store-fulfillment';

export interface StoreSyncJobData {
  shipmentId: string;
  event: FulfillmentEvent;
}
