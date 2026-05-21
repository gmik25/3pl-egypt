import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RemittanceStatus } from '@prisma/client';

import { RemittanceService } from './remittance.service';
import { CreateRemittanceDto, RejectRemittanceDto } from './dto/remittance-dtos';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

@ApiTags('remittances')
@ApiBearerAuth()
@Controller('finance/remittances')
export class RemittanceController {
  constructor(private readonly remittance: RemittanceService) {}

  @Get('eligible-orders')
  @RequirePermissions('remittance.submit', 'finance.read')
  @ApiOperation({ summary: 'Delivered COD orders not yet remitted' })
  eligible(@Query('driverId') driverId?: string) {
    return this.remittance.eligibleOrders(driverId);
  }

  @Get('cod-by-driver')
  @RequirePermissions('finance.read')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiOperation({ summary: 'COD collected per driver per day' })
  codByDriver(@Query('from') from?: string, @Query('to') to?: string) {
    return this.remittance.codByDriverPerDay(from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }

  @Get()
  @RequirePermissions('finance.read')
  @ApiQuery({ name: 'status', required: false, enum: RemittanceStatus })
  @ApiQuery({ name: 'driverId', required: false })
  list(@Query('status') status?: RemittanceStatus, @Query('driverId') driverId?: string) {
    return this.remittance.list(status, driverId);
  }

  @Get(':id')
  @RequirePermissions('finance.read')
  get(@Param('id') id: string) {
    return this.remittance.getById(id);
  }

  @Post()
  @RequirePermissions('remittance.submit')
  @ApiOperation({ summary: 'Submit a COD remittance (driver)' })
  create(@Body() dto: CreateRemittanceDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.remittance.create(dto, actor.id);
  }

  @Post(':id/confirm')
  @RequirePermissions('finance.write')
  @ApiOperation({ summary: 'Confirm a remittance → mark COD remitted + credit client wallets' })
  confirm(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.remittance.confirm(id, actor.id);
  }

  @Post(':id/reject')
  @RequirePermissions('finance.write')
  reject(@Param('id') id: string, @Body() dto: RejectRemittanceDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.remittance.reject(id, dto.note, actor.id);
  }
}
