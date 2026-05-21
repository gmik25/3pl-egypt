import type { GovernorateCode, PaymentMethod } from '@prisma/client';

/** Platform-agnostic order shape that all intake adapters produce. */
export interface NormalizedOrderItem {
  skuCode: string;
  nameAr?: string;
  nameEn?: string;
  quantity: number;
  unitPricePiastres: number;
}

export interface NormalizedOrder {
  externalRef: string;
  customerName: string;
  customerPhone: string;
  customerPhoneAlt?: string;
  governorate: GovernorateCode;
  address: {
    apartment?: string;
    floor?: string;
    building?: string;
    street?: string;
    district?: string;
  };
  paymentMethod: PaymentMethod;
  /** required when paymentMethod = COD */
  codAmountPiastres?: number;
  notes?: string;
  items: NormalizedOrderItem[];
}
