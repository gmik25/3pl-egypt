import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ImportStatus } from '@prisma/client';

import { CustomsService } from './customs.service';
import { CreateImportShipmentDto, DeclareDto, HsCodeDto, ReleaseDto } from './dto/customs-dtos';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

@ApiTags('customs')
@ApiBearerAuth()
@Controller('customs')
export class CustomsController {
  constructor(private readonly customs: CustomsService) {}

  // ---- HS codes ----
  @Get('hs-codes')
  @RequirePermissions('customs.read')
  @ApiQuery({ name: 'search', required: false })
  listHsCodes(@Query('search') search?: string) {
    return this.customs.listHsCodes(search);
  }

  @Put('hs-codes')
  @RequirePermissions('customs.write')
  @ApiOperation({ summary: 'Create or update an HS tariff code' })
  upsertHsCode(@Body() dto: HsCodeDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.customs.upsertHsCode(dto, actor.id);
  }

  // ---- Import shipments ----
  @Get('imports')
  @RequirePermissions('customs.read')
  @ApiQuery({ name: 'status', required: false, enum: ImportStatus })
  @ApiQuery({ name: 'clientId', required: false })
  list(@Query('status') status?: ImportStatus, @Query('clientId') clientId?: string) {
    return this.customs.listShipments(status, clientId);
  }

  @Get('imports/:id')
  @RequirePermissions('customs.read')
  get(@Param('id') id: string) {
    return this.customs.getShipment(id);
  }

  @Get('imports/:id/landed-cost')
  @RequirePermissions('customs.read')
  @ApiOperation({ summary: 'Landed-cost breakdown (CIF + duties + 14% VAT, EGP)' })
  landedCost(@Param('id') id: string) {
    return this.customs.landedCost(id);
  }

  @Post('imports')
  @RequirePermissions('customs.write')
  create(@Body() dto: CreateImportShipmentDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.customs.create(dto, actor);
  }

  @Post('imports/:id/declare')
  @RequirePermissions('customs.write')
  @ApiOperation({ summary: 'Assign ECA declaration number' })
  declare(@Param('id') id: string, @Body() dto: DeclareDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.customs.declare(id, dto.ecaDeclarationNumber, actor);
  }

  @Post('imports/:id/inspect')
  @RequirePermissions('customs.write')
  inspect(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.customs.inspect(id, actor);
  }

  @Post('imports/:id/clear')
  @RequirePermissions('customs.write')
  clear(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.customs.clear(id, actor);
  }

  @Post('imports/:id/release')
  @RequirePermissions('customs.write')
  @ApiOperation({ summary: 'Release cleared goods into warehouse stock' })
  release(@Param('id') id: string, @Body() dto: ReleaseDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.customs.release(id, dto.locationId, actor);
  }
}
