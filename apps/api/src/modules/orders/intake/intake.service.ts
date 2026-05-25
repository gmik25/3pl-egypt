import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { IntakeSource } from '@prisma/client';
import * as Papa from 'papaparse';

import { OrdersService } from '../orders.service';
import { normalizeCsvRow, normalizeWebhook } from './adapters';

export interface IntakeResult {
  created: number;
  failed: { row: number; reason: string }[];
}

@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);

  constructor(private readonly orders: OrdersService) {}

  /** Webhook from an e-commerce platform. clientId identifies which seller the store belongs to. */
  async ingestWebhook(source: IntakeSource, clientId: string, payload: Record<string, unknown>, storeConnectionId?: string) {
    const normalized = normalizeWebhook(source, payload);
    // store the raw payload for traceability/debugging + the store link for outbound sync
    return this.orders.createFromIntake(clientId, normalized, source, payload as never, null, storeConnectionId);
  }

  /**
   * Bulk CSV upload. Expected headers:
   * external_ref, customer_name, customer_phone, customer_phone_alt, governorate,
   * apartment, floor, building, street, district, payment_method, cod_amount_egp,
   * sku_code, sku_name_ar, quantity, unit_price_egp, notes
   */
  async ingestCsv(clientId: string, csv: string, actorId: string | null): Promise<IntakeResult> {
    const parsed = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });
    if (parsed.errors.length) {
      this.logger.warn(`CSV parse warnings: ${parsed.errors.length}`);
    }
    const rows = parsed.data;
    if (rows.length === 0) throw new BadRequestException('CSV contained no data rows');

    const result: IntakeResult = { created: 0, failed: [] };
    for (let i = 0; i < rows.length; i++) {
      try {
        const normalized = normalizeCsvRow(rows[i]!);
        await this.orders.createFromIntake(clientId, normalized, IntakeSource.CSV, rows[i] as never, actorId);
        result.created++;
      } catch (e) {
        result.failed.push({ row: i + 2, reason: e instanceof Error ? e.message : 'unknown' }); // +2: header + 1-index
      }
    }
    return result;
  }
}
