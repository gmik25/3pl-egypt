import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ContractsService } from './contracts.service';
import { UpdateContractDto } from './dto/update-contract.dto';
import { UpsertSlaDto } from './dto/upsert-sla.dto';
import { PriceQuoteDto } from './dto/price-quote.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get(':id')
  @RequirePermissions('contracts.read')
  get(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.contracts.getById(id, actor);
  }

  @Patch(':id')
  @RequirePermissions('contracts.write')
  update(@Param('id') id: string, @Body() dto: UpdateContractDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.contracts.update(id, dto, actor);
  }

  @Put(':id/sla')
  @RequirePermissions('contracts.write')
  @ApiOperation({ summary: 'Create or replace the SLA for a contract' })
  upsertSla(@Param('id') id: string, @Body() dto: UpsertSlaDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.contracts.upsertSla(id, dto, actor);
  }

  @Post(':id/quote')
  @RequirePermissions('contracts.read')
  @ApiOperation({ summary: 'Compute a what-if service-fee quote (incl. 14% VAT) from contract pricing' })
  quote(@Param('id') id: string, @Body() dto: PriceQuoteDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.contracts.quote(id, dto, actor);
  }
}
