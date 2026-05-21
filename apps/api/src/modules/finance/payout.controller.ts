import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PayoutStatus } from '@prisma/client';

import { PayoutService } from './payout.service';
import { CreatePayoutDto, MarkPaidDto } from './dto/payout-dtos';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

@ApiTags('payouts')
@ApiBearerAuth()
@Controller('finance/payouts')
export class PayoutController {
  constructor(private readonly payouts: PayoutService) {}

  @Get()
  @RequirePermissions('finance.read')
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: PayoutStatus })
  list(@Query('clientId') clientId?: string, @Query('status') status?: PayoutStatus) {
    return this.payouts.list(clientId, status);
  }

  @Post()
  @RequirePermissions('finance.write')
  create(@Body() dto: CreatePayoutDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.payouts.create(dto.clientId, dto.amountPiastres, dto.rail, dto.externalRef, actor.id);
  }

  @Post(':id/paid')
  @RequirePermissions('finance.write')
  markPaid(@Param('id') id: string, @Body() dto: MarkPaidDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.payouts.markPaid(id, dto.externalRef, actor.id);
  }

  @Post(':id/failed')
  @RequirePermissions('finance.write')
  markFailed(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.payouts.markFailed(id, actor.id);
  }
}
