import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { applyVat } from '@3pl/shared';

export interface ContractRates {
  storagePerSkuPerDayPiastres: number;
  pickAndPackPiastres: number;
  codCommissionBps: number;
  returnFeePiastres: number;
}

export interface QuoteInputs {
  skuCount?: number;
  storageDays?: number;
  orderCount?: number;
  codAmountPiastres?: number;
  returnCount?: number;
}

export interface QuoteLine {
  key: 'storage' | 'pickAndPack' | 'codCommission' | 'returnFees';
  /** integer piastres, pre-VAT */
  amountPiastres: number;
}

export interface Quote {
  lines: QuoteLine[];
  netPiastres: number;
  vatPiastres: number;
  grossPiastres: number;
  vatRateBps: number;
}

@Injectable()
export class PricingService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Compute a service-fee quote from a contract's rates and usage inputs.
   * EG: all math in integer piastres; 14% VAT (Law 67/2016) applied to the net service fee total.
   */
  quote(rates: ContractRates, inputs: QuoteInputs): Quote {
    const skuCount = inputs.skuCount ?? 0;
    const storageDays = inputs.storageDays ?? 0;
    const orderCount = inputs.orderCount ?? 0;
    const codAmount = inputs.codAmountPiastres ?? 0;
    const returnCount = inputs.returnCount ?? 0;

    const storage = rates.storagePerSkuPerDayPiastres * skuCount * storageDays;
    const pickAndPack = rates.pickAndPackPiastres * orderCount;
    const codCommission = Math.round((codAmount * rates.codCommissionBps) / 10_000);
    const returnFees = rates.returnFeePiastres * returnCount;

    const lines: QuoteLine[] = [
      { key: 'storage', amountPiastres: storage },
      { key: 'pickAndPack', amountPiastres: pickAndPack },
      { key: 'codCommission', amountPiastres: codCommission },
      { key: 'returnFees', amountPiastres: returnFees },
    ];

    const net = storage + pickAndPack + codCommission + returnFees;
    const vatBps = this.config.get<number>('vatRateBps', 1400);
    const { vat, gross } = applyVat(net, vatBps);

    return {
      lines,
      netPiastres: net,
      vatPiastres: vat,
      grossPiastres: gross,
      vatRateBps: vatBps,
    };
  }
}
