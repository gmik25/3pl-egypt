import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IntakeSource } from '@prisma/client';

import { IntakeService } from './intake.service';
import { Public } from '../../auth/decorators/public.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/types/authenticated-request';

const WEBHOOK_SOURCES: IntakeSource[] = [
  IntakeSource.SHOPIFY,
  IntakeSource.WOOCOMMERCE,
  IntakeSource.SALLA,
  IntakeSource.ZID,
];

@ApiTags('intake')
@Controller('intake')
export class IntakeController {
  constructor(private readonly intake: IntakeService) {}

  // EG: webhook endpoints are Public (no JWT) — platforms can't carry our bearer token.
  // TODO(security): verify each platform's HMAC signature header before trusting the payload.
  @Public()
  @Post('webhook/:source/:clientId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Receive an order webhook from an e-commerce platform' })
  webhook(
    @Param('source', new ParseEnumPipe(IntakeSource)) source: IntakeSource,
    @Param('clientId') clientId: string,
    @Body() payload: Record<string, unknown>,
  ) {
    if (!WEBHOOK_SOURCES.includes(source)) {
      throw new BadRequestException(`${source} is not a webhook source`);
    }
    return this.intake.ingestWebhook(source, clientId, payload);
  }

  @ApiBearerAuth()
  @Post('csv/:clientId')
  @RequirePermissions('orders.write')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Bulk-create orders from a CSV upload' })
  @UseInterceptors(FileInterceptor('file'))
  async csv(
    @Param('clientId') clientId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('file is required');
    return this.intake.ingestCsv(clientId, file.buffer.toString('utf8'), actor.id);
  }
}
