import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CouriersService } from './couriers.service';
import { CreateCourierDto, SetCoverageDto, UpdateCourierDto } from './dto/courier-dtos';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

@ApiTags('integrations-couriers')
@ApiBearerAuth()
@Controller('integrations/couriers')
export class CouriersController {
  constructor(private readonly couriers: CouriersService) {}

  @Get()
  @RequirePermissions('integrations.read')
  list() {
    return this.couriers.list();
  }

  @Get(':id')
  @RequirePermissions('integrations.read')
  get(@Param('id') id: string) {
    return this.couriers.getById(id);
  }

  @Post()
  @RequirePermissions('integrations.write')
  @ApiOperation({ summary: 'Onboard a courier (credentials encrypted at rest)' })
  create(@Body() dto: CreateCourierDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.couriers.create(dto, actor.id);
  }

  @Patch(':id')
  @RequirePermissions('integrations.write')
  update(@Param('id') id: string, @Body() dto: UpdateCourierDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.couriers.update(id, dto, actor.id);
  }

  @Put(':id/coverage')
  @RequirePermissions('integrations.write')
  @ApiOperation({ summary: 'Set per-governorate coverage + ETA' })
  setCoverage(@Param('id') id: string, @Body() dto: SetCoverageDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.couriers.setCoverage(id, dto, actor.id);
  }

  @Post(':id/test-connection')
  @RequirePermissions('integrations.write')
  test(@Param('id') id: string) {
    return this.couriers.testConnection(id);
  }
}
