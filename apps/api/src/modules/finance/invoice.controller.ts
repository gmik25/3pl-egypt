import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';

import { InvoiceService } from './invoice.service';
import { GenerateInvoiceDto } from './dto/invoice-dtos';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('finance/invoices')
export class InvoiceController {
  constructor(private readonly invoices: InvoiceService) {}

  @Get()
  @RequirePermissions('finance.read')
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  list(@Query('clientId') clientId?: string, @Query('status') status?: InvoiceStatus) {
    return this.invoices.list(clientId, status);
  }

  @Get(':id')
  @RequirePermissions('finance.read')
  get(@Param('id') id: string) {
    return this.invoices.getById(id);
  }

  @Get(':id/eta')
  @RequirePermissions('finance.read')
  @ApiOperation({ summary: 'ETA-shaped e-invoice document (model only — not portal-submitted)' })
  eta(@Param('id') id: string) {
    return this.invoices.etaDocument(id);
  }

  @Post('generate')
  @RequirePermissions('finance.write')
  @ApiOperation({ summary: 'Generate a draft invoice for a client + period (service fees + 14% VAT)' })
  generate(@Body() dto: GenerateInvoiceDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.invoices.generate(dto.clientId, dto.periodStart, dto.periodEnd, actor.id);
  }

  @Post(':id/issue')
  @RequirePermissions('finance.write')
  @ApiOperation({ summary: 'Issue the invoice (assigns an ETA UUID placeholder)' })
  issue(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.invoices.issue(id, actor.id);
  }
}
