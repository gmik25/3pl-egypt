import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

import { StorageBillingService } from './storage-billing.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

class ChargeStorageDto {
  @IsDateString() periodStart!: string;
  @IsDateString() periodEnd!: string;
}

@ApiTags('storage-billing')
@ApiBearerAuth()
@Controller('finance/storage-billing')
export class StorageBillingController {
  constructor(private readonly billing: StorageBillingService) {}

  @Get(':clientId/preview')
  @RequirePermissions('finance.read')
  @ApiOperation({ summary: 'Preview a dedicated-storage charge for a client + period' })
  @ApiQuery({ name: 'periodStart' })
  @ApiQuery({ name: 'periodEnd' })
  preview(@Param('clientId') clientId: string, @Query('periodStart') periodStart: string, @Query('periodEnd') periodEnd: string) {
    return this.billing.preview(clientId, periodStart, periodEnd);
  }

  @Post(':clientId/charge')
  @RequirePermissions('finance.write')
  @ApiOperation({ summary: 'Post the storage charge to the client wallet (flows into the next invoice)' })
  charge(@Param('clientId') clientId: string, @Body() dto: ChargeStorageDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.billing.charge(clientId, dto.periodStart, dto.periodEnd, actor.id);
  }
}
