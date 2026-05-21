import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { InventoryService } from './inventory.service';
import { AdjustStockDto, ChangeStatusDto, TransferStockDto } from './dto/inventory-dtos';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/types/authenticated-request';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('sku/:skuId')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Stock levels for a SKU across all locations' })
  bySku(@Param('skuId') skuId: string) {
    return this.inventory.stockBySku(skuId);
  }

  @Get('sku/:skuId/available')
  @RequirePermissions('inventory.read')
  @ApiQuery({ name: 'warehouseId', required: false })
  async available(@Param('skuId') skuId: string, @Query('warehouseId') warehouseId?: string) {
    return { skuId, warehouseId: warehouseId ?? null, available: await this.inventory.availableQty(skuId, warehouseId) };
  }

  @Get('sku/:skuId/fefo')
  @RequirePermissions('inventory.read')
  @ApiQuery({ name: 'warehouseId', required: true })
  @ApiOperation({ summary: 'FEFO pick suggestion (soonest-expiry first)' })
  fefo(@Param('skuId') skuId: string, @Query('warehouseId') warehouseId: string) {
    return this.inventory.fefo(skuId, warehouseId);
  }

  @Get('sku/:skuId/movements')
  @RequirePermissions('inventory.read')
  movements(@Param('skuId') skuId: string) {
    return this.inventory.movementsForSku(skuId);
  }

  @Get('location/:locationId')
  @RequirePermissions('inventory.read')
  byLocation(@Param('locationId') locationId: string) {
    return this.inventory.stockByLocation(locationId);
  }

  @Get('low-stock')
  @RequirePermissions('inventory.read')
  @ApiQuery({ name: 'warehouseId', required: false })
  lowStock(@Query('warehouseId') warehouseId?: string) {
    return this.inventory.lowStock(warehouseId);
  }

  @Post('adjust')
  @RequirePermissions('inventory.write')
  @ApiOperation({ summary: 'Adjust stock at a location (manual +/-)' })
  adjust(@Body() dto: AdjustStockDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.inventory.adjust(dto, actor.id);
  }

  @Post('transfer')
  @RequirePermissions('inventory.write')
  @ApiOperation({ summary: 'Move stock between locations (e.g. putaway)' })
  transfer(@Body() dto: TransferStockDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.inventory.transfer(dto, actor.id);
  }

  @Post('status')
  @RequirePermissions('inventory.write')
  @ApiOperation({ summary: 'Quarantine / release / damage stock at a location' })
  changeStatus(@Body() dto: ChangeStatusDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.inventory.changeStatus(dto, actor.id);
  }
}
