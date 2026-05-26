import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { LocationsService } from './locations.service';
import {
  AllocateLocationsDto,
  BulkGenerateLocationsDto,
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
  @ApiQuery({ name: 'zoneId', required: false })
  @ApiQuery({ name: 'aisle', required: false })
  @ApiQuery({ name: 'rack', required: false })
  @ApiQuery({ name: 'allocatedClientId', required: false })
  @ApiQuery({ name: 'unallocated', required: false, type: Boolean })
  @ApiQuery({ name: 'q', required: false })
  listLocations(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Query('zoneId') zoneId?: string,
    @Query('aisle') aisle?: string,
    @Query('rack') rack?: string,
    @Query('allocatedClientId') allocatedClientId?: string,
    @Query('unallocated') unallocated?: string,
    @Query('q') q?: string,
  ) {
    return this.locations.listLocations(id, actor, { zoneId, aisle, rack, allocatedClientId, unallocated: unallocated === 'true', q });
  }

  @Post(':id/locations')
  @RequirePermissions('warehouse.write')
  createLocation(@Param('id') id: string, @Body() dto: CreateLocationDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.locations.createLocation(id, dto, actor);
  }

  @Post(':id/locations/bulk')
  @RequirePermissions('warehouse.write')
  @ApiOperation({ summary: 'Bulk-generate a storage grid (aisle × rack × level × bin)' })
  generateLocations(@Param('id') id: string, @Body() dto: BulkGenerateLocationsDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.locations.generateLocations(id, dto, actor);
  }

  @Get(':id/allocations')
  @RequirePermissions('warehouse.read')
  @ApiOperation({ summary: 'Per-seller allocation footprint for the warehouse' })
  allocations(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.locations.allocationSummary(id, actor);
  }

  @Get(':id/suggest-locations')
  @RequirePermissions('warehouse.read')
  @ApiOperation({ summary: "A seller's allocated STORAGE locations (putaway suggestions)" })
  suggest(@Param('id') id: string, @Query('clientId') clientId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.locations.suggestLocationsForClient(id, clientId, actor);
  }

  @Post('allocate-locations')
  @RequirePermissions('warehouse.write')
  @ApiOperation({ summary: 'Allocate (or release) locations to a seller' })
  allocate(@Body() dto: AllocateLocationsDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.locations.allocateLocations(dto, actor);
  }
}
