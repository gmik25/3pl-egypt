import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CycleCountStatus } from '@prisma/client';
import { IsInt, IsString, Min } from 'class-validator';

import { CountingService } from './counting.service';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/types/authenticated-request';

class OpenCountDto {
  @IsString() warehouseId!: string;
  @IsString() locationId!: string;
  @IsString() skuId!: string;
}
class RecordCountDto {
  @IsInt() @Min(0) countedQty!: number;
}

@ApiTags('cycle-counts')
@ApiBearerAuth()
@Controller('inventory/cycle-counts')
export class CountingController {
  constructor(private readonly counting: CountingService) {}

  @Get()
  @RequirePermissions('inventory.read')
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: CycleCountStatus })
  list(@Query('warehouseId') warehouseId?: string, @Query('status') status?: CycleCountStatus) {
    return this.counting.list(warehouseId, status);
  }

  @Post()
  @RequirePermissions('inventory.write')
  @ApiOperation({ summary: 'Open a cycle count (snapshots expected qty)' })
  open(@Body() dto: OpenCountDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.counting.open(dto.warehouseId, dto.locationId, dto.skuId, actor.id);
  }

  @Post(':id/count')
  @RequirePermissions('inventory.write')
  @ApiOperation({ summary: 'Record the physical count' })
  record(@Param('id') id: string, @Body() dto: RecordCountDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.counting.recordCount(id, dto.countedQty, actor.id);
  }

  @Post(':id/reconcile')
  @RequirePermissions('inventory.write')
  @ApiOperation({ summary: 'Post the variance and close the count' })
  reconcile(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.counting.reconcile(id, actor.id);
  }
}
