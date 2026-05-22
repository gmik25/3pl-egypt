import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { ReportingService, type DateRange } from './reporting.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

function parseRange(from?: string, to?: string): DateRange {
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * 86_400_000);
  return { from: fromDate, to: toDate };
}

/** Serialise an array of flat objects to CSV (Excel-openable). */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))];
  // BOM so Excel reads UTF-8 (Arabic) correctly
  return '﻿' + lines.join('\n');
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @Get('ops-kpis')
  @RequirePermissions('reports.read')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiOperation({ summary: 'Operational KPIs (fulfilment, on-time, COD collection)' })
  opsKpis(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reporting.opsKpis(parseRange(from, to));
  }

  @Get('revenue-per-client')
  @RequirePermissions('reports.read')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  revenuePerClient(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reporting.revenuePerClient(parseRange(from, to));
  }

  @Get('courier-scorecard')
  @RequirePermissions('reports.read')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  courierScorecard(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reporting.courierScorecard(parseRange(from, to));
  }

  @Get('inventory')
  @RequirePermissions('reports.read')
  inventory() {
    return this.reporting.inventoryByWarehouse();
  }

  // ---- CSV exports (Excel-openable, UTF-8 BOM for Arabic) ----

  @Get('revenue-per-client.csv')
  @RequirePermissions('reports.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="revenue-per-client.csv"')
  async revenueCsv(@Query('from') from?: string, @Query('to') to?: string) {
    return toCsv(await this.reporting.revenuePerClient(parseRange(from, to)) as unknown as Record<string, unknown>[]);
  }

  @Get('courier-scorecard.csv')
  @RequirePermissions('reports.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="courier-scorecard.csv"')
  async courierCsv(@Query('from') from?: string, @Query('to') to?: string) {
    return toCsv(await this.reporting.courierScorecard(parseRange(from, to)) as unknown as Record<string, unknown>[]);
  }

  @Get('inventory.csv')
  @RequirePermissions('reports.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="inventory.csv"')
  async inventoryCsv() {
    return toCsv(await this.reporting.inventoryByWarehouse() as unknown as Record<string, unknown>[]);
  }
}
