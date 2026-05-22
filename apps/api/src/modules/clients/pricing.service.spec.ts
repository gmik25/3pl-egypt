import type { ConfigService } from '@nestjs/config';
import { PricingService } from './pricing.service';

// Minimal fake ConfigService — pricing only reads vatRateBps (14% = 1400 bps).
const config = { get: () => 1400 } as unknown as ConfigService;

describe('PricingService.quote', () => {
  const svc = new PricingService(config);
  const rates = { storagePerSkuPerDayPiastres: 500, pickAndPackPiastres: 1500, codCommissionBps: 250, returnFeePiastres: 2000 };

  it('computes line items + 14% VAT in piastres', () => {
    const q = svc.quote(rates, { skuCount: 10, storageDays: 30, orderCount: 100, codAmountPiastres: 500000, returnCount: 5 });
    // storage 150000 + pickPack 150000 + commission 12500 + returns 10000 = 322500 net
    expect(q.netPiastres).toBe(322500);
    expect(q.vatPiastres).toBe(45150); // 14% of 322500
    expect(q.grossPiastres).toBe(367650);
    const commission = q.lines.find((l) => l.key === 'codCommission');
    expect(commission?.amountPiastres).toBe(12500); // 2.50% of 500000
  });

  it('returns zeros for empty usage', () => {
    const q = svc.quote(rates, {});
    expect(q.netPiastres).toBe(0);
    expect(q.grossPiastres).toBe(0);
  });
});
