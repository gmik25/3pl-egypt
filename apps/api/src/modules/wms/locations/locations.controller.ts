import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { LocationsService } from './locations.service';
import {
  CreateLocationDto,
  CreateWarehouseDto,
  CreateZoneDto,
  UpdateWarehouseDto,
} from './dto/location-dtos';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/types/authenticated-request';

@ApiTags('warehouses')
@ApiBearerAuth()
@Controller('warehouses')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @RequirePermissions('warehouse.read')
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.locations.listWarehouses(actor);
  }

  @Get(':id')
  @RequirePermissions('warehouse.read')
  get(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.locations.getWarehouse(id, actor);
  }

  @Post()
  @RequirePermissions('warehouse.write')
  create(@Body() dto: CreateWarehouseDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.locations.createWarehouse(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions('warehouse.write')
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.locations.updateWarehouse(id, dto, actor);
  }

  @Post(':id/zones')
  @RequirePermissions('warehouse.write')
  createZone(@Param('id') id: string, @Body() dto: CreateZoneDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.locations.createZone(id, dto, actor);
  }

  @Get(':id/locations')
  @RequirePermissions('warehouse.read')
  listLocations(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.locations.listLocations(id, actor);
  }

  @Post(':id/locations')
  @RequirePermissions('warehouse.write')
  createLocation(@Param('id') id: string, @Body() dto: CreateLocationDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.locations.createLocation(id, dto, actor);
  }
}
