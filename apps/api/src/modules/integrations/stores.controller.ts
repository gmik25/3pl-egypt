import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Req,
  Res,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StorePlatform } from '@prisma/client';

import { StoresService } from './stores.service';
import { ConnectStoreDto } from './dto/store-dtos';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

@ApiTags('integrations-stores')
@Controller('integrations/stores')
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  @ApiBearerAuth()
  @RequirePermissions('integrations.read')
  list() {
    return this.stores.list();
  }

  @Post('connect')
  @ApiBearerAuth()
  @RequirePermissions('integrations.write')
  @ApiOperation({ summary: 'Begin store OAuth — returns the platform authorize URL' })
  connect(@Body() dto: ConnectStoreDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.stores.connect(dto, actor.id);
  }

  @Post(':id/disconnect')
  @ApiBearerAuth()
  @RequirePermissions('integrations.write')
  disconnect(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.stores.disconnect(id, actor.id);
  }

  @Post(':id/resubscribe')
  @ApiBearerAuth()
  @RequirePermissions('integrations.write')
  @ApiOperation({ summary: 'Re-register order webhooks + re-queue a historical backfill' })
  resubscribe(@Param('id') id: string) {
    return this.stores.resubscribe(id);
  }

  // EG: OAuth callback hit by the platform's browser redirect — Public, then 302 back to the web app.
  @Public()
  @Get('callback/:platform')
  @ApiOperation({ summary: 'OAuth redirect target (exchanges code → token)' })
  async callback(
    @Param('platform', new ParseEnumPipe(StorePlatform)) platform: StorePlatform,
    @Query() query: { code?: string; state?: string; shop?: string },
    @Res() res: Response,
  ) {
    const redirectTo = await this.stores.handleCallback(platform, query);
    res.redirect(redirectTo);
  }

  // EG: inbound order webhook — Public (platforms can't carry our bearer), HMAC-verified per store.
  @Public()
  @Post('webhook/:platform')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Receive an order webhook; store resolved by domain header' })
  webhook(
    @Param('platform', new ParseEnumPipe(StorePlatform)) platform: StorePlatform,
    @Body() payload: Record<string, unknown>,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const shopDomain =
      (req.headers['x-shopify-shop-domain'] as string | undefined) ??
      (req.headers['x-store-domain'] as string | undefined);
    const signature =
      (req.headers['x-shopify-hmac-sha256'] as string | undefined) ??
      (req.headers['x-webhook-signature'] as string | undefined) ??
      null;
    return this.stores.ingestStoreWebhook(platform, shopDomain, payload, req.rawBody, signature);
  }
}
