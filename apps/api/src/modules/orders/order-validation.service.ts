import { Injectable } from '@nestjs/common';
import type { GovernorateCode, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface ValidationInput {
  clientId: string;
  externalRef?: string | null;
  customerPhone: string;
  governorate: GovernorateCode;
  paymentMethod: PaymentMethod;
  codAmountPiastres?: number | null;
}

export interface ValidationResult {
  /** true = exact duplicate, caller should reject */
  isDuplicate: boolean;
  /** non-blocking fraud/quality flags; joined into Order.flaggedReason */
  flags: string[];
}

// EG: COD is dominant, so COD-specific risk checks are first-class, not edge cases.
const HIGH_COD_THRESHOLD_PIASTRES = 2_000_000; // EGP 20,000
const FAILED_HISTORY_THRESHOLD = 2;

@Injectable()
export class OrderValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(input: ValidationInput): Promise<ValidationResult> {
    const flags: string[] = [];

    // ---- Duplicate detection: same client + same externalRef ----
    let isDuplicate = false;
    if (input.externalRef) {
      const existing = await this.prisma.order.findFirst({
        where: { clientId: input.clientId, externalRef: input.externalRef },
        select: { id: true },
      });
      if (existing) isDuplicate = true;
    }

    // ---- Soft duplicate: same phone + same client in the last 10 minutes ----
    if (!isDuplicate) {
      const tenMinAgo = new Date(Date.now() - 10 * 60_000);
      const recent = await this.prisma.order.count({
        where: {
          clientId: input.clientId,
          customerPhone: input.customerPhone,
          createdAt: { gte: tenMinAgo },
        },
      });
      if (recent > 0) flags.push('POSSIBLE_DUPLICATE_RECENT_PHONE');
    }

    // ---- Fraud: phone with repeated failed/returned COD history ----
    const failedHistory = await this.prisma.order.count({
      where: {
        customerPhone: input.customerPhone,
        state: { in: ['FAILED', 'RETURNED'] },
      },
    });
    if (failedHistory >= FAILED_HISTORY_THRESHOLD) {
      flags.push(`REPEAT_FAILED_COD_PHONE(${failedHistory})`);
    }

    // ---- Risk: unusually high COD value ----
    if (
      input.paymentMethod === 'COD' &&
      (input.codAmountPiastres ?? 0) >= HIGH_COD_THRESHOLD_PIASTRES
    ) {
      flags.push('HIGH_COD_VALUE');
    }

    // ---- Data quality: COD order without an amount ----
    if (input.paymentMethod === 'COD' && !input.codAmountPiastres) {
      flags.push('COD_MISSING_AMOUNT');
    }

    return { isDuplicate, flags };
  }
}
