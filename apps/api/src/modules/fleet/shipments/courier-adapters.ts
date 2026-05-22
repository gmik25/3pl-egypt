import * as crypto from 'node:crypto';

// EG: stubbed courier integrations. Each real courier (Aramex/Bosta/R2S/Mylerz/J&T) exposes a
// create-shipment API returning a tracking number + label. These stubs simulate that contract so
// the rest of the system is wired correctly; swap in real HTTP clients (per CourierAccount
// apiBaseUrl + decrypted credentials) here.

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

const PREFIX: Record<string, string> = {
  ARAMEX: 'ARMX',
  BOSTA: 'BOSTA',
  R2S: 'R2S',
  MYLERZ: 'MYLZ',
  JT: 'JT',
};

export function createCourierShipment(courierCode: string, _req: CourierShipmentRequest): CourierShipmentResult {
  // TODO(integration): replace with the courier's real create-shipment API call (auth, HMAC, retries).
  const prefix = PREFIX[courierCode] ?? courierCode.slice(0, 5).toUpperCase();
  const tracking = `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  return { trackingNumber: tracking, labelUrl: `/labels/${tracking}.pdf` };
}

/** Map a courier webhook status string to our ShipmentStatus. */
export function mapCourierStatus(raw: string): 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED' | null {
  const s = raw.toLowerCase();
  // Order matters: "delivery failed"/"returned" also contain "deliver", so check the
  // negative outcomes and in-transit states before the success match.
  if (s.includes('return')) return 'RETURNED';
  if (s.includes('fail') || s.includes('unreach')) return 'FAILED';
  if (s.includes('out') || s.includes('transit')) return 'OUT_FOR_DELIVERY';
  if (s.includes('deliver')) return 'DELIVERED';
  return null;
}
