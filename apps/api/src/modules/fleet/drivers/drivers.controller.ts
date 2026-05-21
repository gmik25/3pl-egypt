import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GovernorateCode } from '@prisma/client';

import { DriversService } from './drivers.service';
import { RegisterDriverDto, UpdateDriverDto } from './dto/driver-dtos';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/types/authenticated-request';

@ApiTags('drivers')
@ApiBearerAuth()
@Controller('fleet/drivers')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get()
  @RequirePermissions('fleet.read')
  @ApiQuery({ name: 'governorate', required: false, enum: GovernorateCode })
  @ApiQuery({ name: 'availableOnly', required: false, type: Boolean })
  list(@Query('governorate') governorate?: GovernorateCode, @Query('availableOnly') availableOnly?: string) {
    return this.drivers.list(governorate, availableOnly === 'true');
  }

  @Post()
  @RequirePermissions('fleet.write')
  register(@Body() dto: RegisterDriverDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.drivers.register(dto, actor.id);
  }

  @Patch(':userId')
  @RequirePermissions('fleet.write')
  update(@Param('userId') userId: string, @Body() dto: UpdateDriverDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.drivers.update(userId, dto, actor.id);
  }
}
