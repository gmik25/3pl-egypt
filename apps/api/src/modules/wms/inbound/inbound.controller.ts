import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PurchaseOrderStatus } from '@prisma/client';

import { InboundService } from './inbound.service';
import { CreatePurchaseOrderDto, ReceiveLineDto } from './dto/inbound-dtos';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/types/authenticated-request';

@ApiTags('inbound')
@ApiBearerAuth()
@Controller('inbound/purchase-orders')
export class InboundController {
  constructor(private readonly inbound: InboundService) {}

  @Get()
  @RequirePermissions('inventory.read')
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: PurchaseOrderStatus })
  list(@Query('warehouseId') warehouseId?: string, @Query('status') status?: PurchaseOrderStatus) {
    return this.inbound.list(warehouseId, status);
  }

  @Get(':id')
  @RequirePermissions('inventory.read')
  get(@Param('id') id: string) {
    return this.inbound.getById(id);
  }

  @Post()
  @RequirePermissions('inventory.write')
  create(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.inbound.create(dto, actor.id);
  }

  @Post('receive')
  @RequirePermissions('inventory.write')
  @ApiOperation({ summary: 'Receive a quantity against a PO line (inspection → stock status)' })
  receive(@Body() dto: ReceiveLineDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.inbound.receive(dto, actor.id);
  }
}
