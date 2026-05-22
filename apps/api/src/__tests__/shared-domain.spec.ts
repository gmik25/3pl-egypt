import {
  applyVat,
  egpToPiastres,
  extractVat,
  findGovernorate,
  ORDER_STATE_TRANSITIONS,
  piastresToEgp,
  GOVERNORATES,
} from '@3pl/shared';

describe('@3pl/shared money (piastres / VAT)', () => {
  it('parses EGP to integer piastres, incl. Arabic-Indic digits', () => {
    expect(egpToPiastres('123.45')).toBe(12345);
    expect(egpToPiastres('123')).toBe(12300);
    expect(egpToPiastres('١٢٣.٤٥')).toBe(12345);
  });

  it('formats piastres back to EGP', () => {
    expect(piastresToEgp(12345)).toBe('123.45');
    expect(piastresToEgp(5)).toBe('0.05');
  });

  it('applies 14% VAT and extracts it as an inverse', () => {
    expect(applyVat(10000)).toEqual({ net: 10000, vat: 1400, gross: 11400 });
    expect(extractVat(11400)).toEqual({ net: 10000, vat: 1400, gross: 11400 });
  });
});

describe('@3pl/shared governorates', () => {
  it('has all 27 governorates', () => {
    expect(GOVERNORATES).toHaveLength(27);
  });
  it('resolves free-text names (English + Arabic) to ISO codes', () => {
    expect(findGovernorate('Cairo')?.code).toBe('C');
    expect(findGovernorate('القاهرة')?.code).toBe('C');
    expect(findGovernorate('alexandria ')?.code).toBe('ALX');
    expect(findGovernorate('Nowhere')).toBeUndefined();
  });
});

describe('OMS order state machine', () => {
  it('only allows the documented forward transitions', () => {
    expect(ORDER_STATE_TRANSITIONS.PENDING).toEqual(['PICKED']);
    expect(ORDER_STATE_TRANSITIONS.DISPATCHED).toEqual(['DELIVERED', 'FAILED']);
    expect(ORDER_STATE_TRANSITIONS.DELIVERED).toEqual(['RETURNED']);
    expect(ORDER_STATE_TRANSITIONS.RETURNED).toEqual([]);
  });
  it('does not allow skipping states', () => {
    expect(ORDER_STATE_TRANSITIONS.PENDING).not.toContain('DELIVERED');
    expect(ORDER_STATE_TRANSITIONS.PACKED).not.toContain('DELIVERED');
  });
});
