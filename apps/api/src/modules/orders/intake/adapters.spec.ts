import { normalizeWebhook, normalizeCsvRow } from './adapters';

describe('intake adapters', () => {
  it('normalizes a Shopify COD webhook (province → governorate, decimals → piastres)', () => {
    const n = normalizeWebhook('SHOPIFY', {
      id: 99123,
      total_price: '450.00',
      gateway: 'Cash on Delivery',
      financial_status: 'pending',
      shipping_address: { first_name: 'Mona', last_name: 'Ali', phone: '+201001234567', province: 'Cairo', address1: 'Tahrir St', city: 'Downtown' },
      line_items: [{ sku: 'SKU-1', title: 'Widget', quantity: 2, price: '225.00' }],
    });
    expect(n.externalRef).toBe('99123');
    expect(n.governorate).toBe('C');
    expect(n.paymentMethod).toBe('COD');
    expect(n.codAmountPiastres).toBe(45000);
    expect(n.items[0]).toMatchObject({ skuCode: 'SKU-1', quantity: 2, unitPricePiastres: 22500 });
  });

  it('normalizes a CSV row with Arabic governorate + EGP decimals', () => {
    const n = normalizeCsvRow({
      external_ref: 'CSV-1', customer_name: 'Sara', customer_phone: '01112223334',
      governorate: 'Giza', payment_method: 'COD', cod_amount_egp: '300.50',
      sku_code: 'A1', quantity: '1', unit_price_egp: '300.50',
    } as Record<string, string>);
    expect(n.governorate).toBe('GZ');
    expect(n.codAmountPiastres).toBe(30050);
    expect(n.items[0].unitPricePiastres).toBe(30050);
  });

  it('rejects an unrecognised governorate', () => {
    expect(() => normalizeCsvRow({ governorate: 'Atlantis' } as Record<string, string>)).toThrow();
  });
});
