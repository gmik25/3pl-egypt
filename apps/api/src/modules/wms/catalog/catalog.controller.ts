import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CatalogService } from './catalog.service';
import { CreateSkuDto } from './dto/create-sku.dto';
import { UpdateSkuDto } from './dto/update-sku.dto';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/types/authenticated-request';

@ApiTags('catalog')
@ApiBearerAuth()
@Controller('catalog/skus')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @RequirePermissions('catalog.read')
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  list(
    @Query('clientId') clientId?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.catalog.list({
      clientId,
      search,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('barcode/:barcode')
  @RequirePermissions('catalog.read')
  @ApiOperation({ summary: 'Resolve a SKU by scanned barcode' })
  byBarcode(@Param('barcode') barcode: string) {
    return this.catalog.getByBarcode(barcode);
  }

  @Get(':id')
  @RequirePermissions('catalog.read')
  get(@Param('id') id: string) {
    return this.catalog.getById(id);
  }

  @Post()
  @RequirePermissions('catalog.write')
  create(@Body() dto: CreateSkuDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.catalog.create(dto, actor.id);
  }

  @Patch(':id')
  @RequirePermissions('catalog.write')
  update(@Param('id') id: string, @Body() dto: UpdateSkuDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.catalog.update(id, dto, actor.id);
  }
}
