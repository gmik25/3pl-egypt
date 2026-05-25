import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { StoresService } from './stores.service';
import { PortalConnectStoreDto } from './dto/store-dtos';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

/**
 * Seller self-serve store connect. EG: a CLIENT-role user manages only their OWN stores —
 * the clientId is resolved server-side from the token, never trusted from the request.
 */
@ApiTags('portal-stores')
@ApiBearerAuth()
@Controller('portal/stores')
export class PortalStoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  @ApiOperation({ summary: "List the signed-in seller's own store connections" })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.stores.listForUser(user.id);
  }

  @Post('connect')
  @ApiOperation({ summary: 'Connect a store to the signed-in seller (returns the authorize URL)' })
  connect(@Body() dto: PortalConnectStoreDto, @CurrentUser() user: AuthenticatedUser) {
    return this.stores.connectForUser(user.id, dto);
  }

  @Post(':id/disconnect')
  disconnect(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.stores.disconnectForUser(user.id, id);
  }
}
