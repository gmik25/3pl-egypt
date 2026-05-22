import { computeLandedCost } from './landed-cost';

describe('computeLandedCost', () => {
  it('allocates freight/insurance pro-rata, applies per-line duty, and 14% VAT on the duty-inclusive value', () => {
    const r = computeLandedCost(
      [
        { ref: 'A', quantity: 100, unitCostPiastres: 5000, dutyRateBps: 3000 }, // 500,000 goods, 30% duty
        { ref: 'B', quantity: 10, unitCostPiastres: 20000, dutyRateBps: 0 }, // 200,000 goods, 0% duty
      ],
      50000, // freight
      10000, // insurance
      1400, // VAT 14%
    );
    expect(r.goodsTotalPiastres).toBe(700000);
    expect(r.cifPiastres).toBe(760000);
    expect(r.lines[0].dutyPiastres).toBe(162857); // round((500000 + 42857) * 0.30)
    expect(r.lines[1].dutyPiastres).toBe(0);
    expect(r.totalDutyPiastres).toBe(162857);
    expect(r.vatPiastres).toBe(129200); // round((760000 + 162857) * 0.14)
    expect(r.landedTotalPiastres).toBe(1052057);
  });

  it('handles zero goods without dividing by zero', () => {
    const r = computeLandedCost([{ ref: 'X', quantity: 0, unitCostPiastres: 0, dutyRateBps: 1000 }], 0, 0, 1400);
    expect(r.landedTotalPiastres).toBe(0);
    expect(r.lines[0].dutyPiastres).toBe(0);
  });
});
