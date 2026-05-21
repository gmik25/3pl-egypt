// EG: All EGP amounts are stored as integer piastres (1 EGP = 100 piastres)
// to avoid float-precision errors. Never store currency as float / number-of-EGP.

/** Egyptian VAT, expressed in basis points (1400 bps = 14%). */
export const VAT_RATE_BPS = 1400;

/** Convert piastres -> EGP string with 2 decimal places. */
export function piastresToEgp(piastres: number): string {
  if (!Number.isInteger(piastres)) {
    throw new Error(`piastres must be an integer, got: ${piastres}`);
  }
  const sign = piastres < 0 ? '-' : '';
  const abs = Math.abs(piastres);
  const egp = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}${egp}.${rem.toString().padStart(2, '0')}`;
}

/**
 * Parse a user-entered EGP amount ("123", "123.45", "123,45") into integer piastres.
 * Accepts Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) too. Rounds half-up at the 3rd decimal.
 */
export function egpToPiastres(egp: string | number): number {
  let raw = typeof egp === 'number' ? egp.toString() : egp.trim();
  raw = raw.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  raw = raw.replace(/[, ]/g, '.').replace(/\.(?=.*\.)/g, '');
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid EGP amount: ${egp}`);
  }
  return Math.round(num * 100);
}

/** Locale-aware EGP formatting. Defaults to ar-EG. */
export function formatEgp(
  piastres: number,
  opts: { locale?: 'ar-EG' | 'en-EG'; withCurrency?: boolean } = {},
): string {
  const { locale = 'ar-EG', withCurrency = true } = opts;
  const value = piastres / 100;
  return new Intl.NumberFormat(locale, {
    style: withCurrency ? 'currency' : 'decimal',
    currency: 'EGP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export interface VatBreakdown {
  /** Net (pre-VAT) amount, in piastres. */
  net: number;
  /** VAT amount, in piastres. */
  vat: number;
  /** Gross (VAT-inclusive) amount, in piastres. */
  gross: number;
}

/**
 * Apply VAT to a NET amount.
 * EG: VAT 14% per Law 67/2016 — applied to service fees (storage, pick&pack, COD commission, return fees).
 */
export function applyVat(netPiastres: number, vatBps: number = VAT_RATE_BPS): VatBreakdown {
  if (!Number.isInteger(netPiastres)) {
    throw new Error(`netPiastres must be an integer, got: ${netPiastres}`);
  }
  const vat = Math.round((netPiastres * vatBps) / 10_000);
  return { net: netPiastres, vat, gross: netPiastres + vat };
}

/**
 * Extract VAT from a VAT-INCLUSIVE gross amount.
 * Useful when a customer pays a gross total and we need to split it for ETA e-invoicing.
 */
export function extractVat(grossPiastres: number, vatBps: number = VAT_RATE_BPS): VatBreakdown {
  if (!Number.isInteger(grossPiastres)) {
    throw new Error(`grossPiastres must be an integer, got: ${grossPiastres}`);
  }
  const net = Math.round((grossPiastres * 10_000) / (10_000 + vatBps));
  return { net, vat: grossPiastres - net, gross: grossPiastres };
}
