import { createCourierShipment, mapCourierStatus } from './courier-adapters';

describe('courier adapters', () => {
  it('mints a tracking number with the courier prefix', () => {
    const r = createCourierShipment('BOSTA', { orderReference: 'O-1', customerName: 'X', customerPhone: '+20', governorate: 'C' });
    expect(r.trackingNumber).toMatch(/^BOSTA-[0-9A-F]{8}$/);
    expect(r.labelUrl).toContain(r.trackingNumber);
  });

  it('maps courier webhook statuses to shipment statuses', () => {
    expect(mapCourierStatus('Delivered')).toBe('DELIVERED');
    expect(mapCourierStatus('out_for_delivery')).toBe('OUT_FOR_DELIVERY');
    expect(mapCourierStatus('in_transit')).toBe('OUT_FOR_DELIVERY');
    expect(mapCourierStatus('returned to sender')).toBe('RETURNED');
    expect(mapCourierStatus('delivery failed')).toBe('FAILED');
    expect(mapCourierStatus('something else')).toBeNull();
  });
});
