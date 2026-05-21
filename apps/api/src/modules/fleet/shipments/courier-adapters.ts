import * as crypto from 'node:crypto';
import type { CourierName } from '@prisma/client';

// EG: stubbed courier integrations. Each real courier (Aramex/Bosta/R2S/Mylerz/J&T) exposes a
// create-shipment API returning a tracking number + label. These stubs simulate that contract so
// the rest of the system is wired correctly; swap in real HTTP clients + credentials per courier.

export interface CourierShipmentRequest {
  orderReference: string;
  customerName: string;
  customerPhone: string;
  governorate: string;
  codAmountPiastres?: number | null;
}

export interface CourierShipmentResult {
  trackingNumber: string;
  /** courier-side label URL (stub) */
  labelUrl: string;
}

const PREFIX: Record<CourierName, string> = {
  ARAMEX: 'ARMX',
  BOSTA: 'BOSTA',
  R2S: 'R2S',
  MYLERZ: 'MYLZ',
  JT: 'JT',
};

export function createCourierShipment(courier: CourierName, _req: CourierShipmentRequest): CourierShipmentResult {
  // TODO(integration): replace with the courier's real create-shipment API call (auth, HMAC, retries).
  const tracking = `${PREFIX[courier]}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  return { trackingNumber: tracking, labelUrl: `/labels/${tracking}.pdf` };
}

/** Map a courier webhook status string to our ShipmentStatus. */
export function mapCourierStatus(raw: string): 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED' | null {
  const s = raw.toLowerCase();
  if (s.includes('deliver') && !s.includes('out')) return 'DELIVERED';
  if (s.includes('out_for') || s.includes('out for') || s.includes('in_transit') || s.includes('transit')) return 'OUT_FOR_DELIVERY';
  if (s.includes('return')) return 'RETURNED';
  if (s.includes('fail') || s.includes('unreach')) return 'FAILED';
  return null;
}
