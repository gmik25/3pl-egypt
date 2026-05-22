// EG: simplified Egyptian landed-cost model. All amounts in integer piastres.
// CIF = goods (FOB) + freight + insurance. Duty is assessed per line on its CIF share;
// VAT (14%) applies on the duty-inclusive value (customs value + duty).

export interface LandedCostLineInput {
  ref: string; // line id or sku code, for the breakdown
  quantity: number;
  unitCostPiastres: number;
  dutyRateBps: number;
}

export interface LandedCostLineResult {
  ref: string;
  goodsPiastres: number;
  cifSharePiastres: number;
  dutyPiastres: number;
}

export interface LandedCost {
  goodsTotalPiastres: number;
  freightPiastres: number;
  insurancePiastres: number;
  cifPiastres: number;
  totalDutyPiastres: number;
  vatRateBps: number;
  vatPiastres: number;
  landedTotalPiastres: number;
  lines: LandedCostLineResult[];
}

export function computeLandedCost(
  lines: LandedCostLineInput[],
  freightPiastres: number,
  insurancePiastres: number,
  vatBps: number,
): LandedCost {
  const goodsTotal = lines.reduce((s, l) => s + l.quantity * l.unitCostPiastres, 0);
  const extras = freightPiastres + insurancePiastres;

  const lineResults: LandedCostLineResult[] = lines.map((l) => {
    const goods = l.quantity * l.unitCostPiastres;
    // pro-rata allocation of freight+insurance by goods value
    const share = goodsTotal > 0 ? Math.round((extras * goods) / goodsTotal) : 0;
    const cifShare = goods + share;
    const duty = Math.round((cifShare * l.dutyRateBps) / 10_000);
    return { ref: l.ref, goodsPiastres: goods, cifSharePiastres: cifShare, dutyPiastres: duty };
  });

  const cif = goodsTotal + extras;
  const totalDuty = lineResults.reduce((s, l) => s + l.dutyPiastres, 0);
  const vat = Math.round(((cif + totalDuty) * vatBps) / 10_000);

  return {
    goodsTotalPiastres: goodsTotal,
    freightPiastres,
    insurancePiastres,
    cifPiastres: cif,
    totalDutyPiastres: totalDuty,
    vatRateBps: vatBps,
    vatPiastres: vat,
    landedTotalPiastres: cif + totalDuty + vat,
    lines: lineResults,
  };
}
