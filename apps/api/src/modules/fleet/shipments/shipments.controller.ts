import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CarrierType, GovernorateCode, ShipmentStatus } from '@prisma/client';

import { ShipmentsService } from './shipments.service';
import { CapturePodMetaDto, CapturePodOtpDto, CreateShipmentDto, RecordFailedAttemptDto } from './dto/shipment-dtos';
import { Public } from '../../auth/decorators/public.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/types/authenticated-request';

@ApiTags('shipments')
@Controller('fleet')
export class ShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  @Get('shipments')
  @ApiBearerAuth()
  @RequirePermissions('fleet.read')
  @ApiQuery({ name: 'status', required: false, enum: ShipmentStatus })
  @ApiQuery({ name: 'governorate', required: false, enum: GovernorateCode })
  @ApiQuery({ name: 'carrierType', required: false, enum: CarrierType })
  @ApiQuery({ name: 'driverId', required: false })
  list(
    @Query('status') status?: ShipmentStatus,
    @Query('governorate') governorate?: GovernorateCode,
    @Query('carrierType') carrierType?: CarrierType,
    @Query('driverId') driverId?: string,
  ) {
    return this.shipments.list({ status, governorate, carrierType, driverId });
  }

  @Get('shipments/coverage/:governorate')
  @ApiBearerAuth()
  @RequirePermissions('fleet.read')
  @ApiOperation({ summary: 'Suggest carriers (couriers + in-house drivers) for a governorate' })
  coverage(@Param('governorate', new ParseEnumPipe(GovernorateCode)) governorate: GovernorateCode) {
    return this.shipments.suggestCarriers(governorate);
  }

  @Get('shipments/:id')
  @ApiBearerAuth()
  @RequirePermissions('fleet.read')
  get(@Param('id') id: string) {
    return this.shipments.getById(id);
  }

  @Post('shipments')
  @ApiBearerAuth()
  @RequirePermissions('fleet.write')
  @ApiOperation({ summary: 'Create a shipment for a PACKED order (→ dispatches it)' })
  create(@Body() dto: CreateShipmentDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.shipments.create(dto, actor);
  }

  @Post('shipments/:id/out-for-delivery')
  @ApiBearerAuth()
  @RequirePermissions('delivery.execute')
  outForDelivery(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.shipments.markOutForDelivery(id, actor.id);
  }

  @Post('shipments/:id/fail')
  @ApiBearerAuth()
  @RequirePermissions('delivery.execute')
  @ApiOperation({ summary: 'Record a failed delivery attempt (re-attempt or RETURN after max)' })
  fail(@Param('id') id: string, @Body() dto: RecordFailedAttemptDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.shipments.recordFailedAttempt(id, dto.failureReason, dto.note, actor);
  }

  // ---- POD ----

  @Post('shipments/:id/pod/otp/request')
  @ApiBearerAuth()
  @RequirePermissions('delivery.execute')
  @ApiOperation({ summary: 'Generate + send a delivery OTP to the customer' })
  requestOtp(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.shipments.requestOtp(id, actor.id);
  }

  @Post('shipments/:id/pod/otp/verify')
  @ApiBearerAuth()
  @RequirePermissions('delivery.execute')
  @ApiOperation({ summary: 'Verify the delivery OTP → POD + deliver' })
  verifyOtp(@Param('id') id: string, @Body() dto: CapturePodOtpDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.shipments.capturePodOtp(id, dto.code, dto.recipientName, actor);
  }

  @Post('shipments/:id/pod/photo')
  @ApiBearerAuth()
  @RequirePermissions('delivery.execute')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { recipientName: { type: 'string' }, file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file'))
  podPhoto(@Param('id') id: string, @Body() dto: CapturePodMetaDto, @UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() actor: AuthenticatedUser) {
    if (!file) throw new BadRequestException('file is required');
    return this.shipments.capturePodFile(id, 'PHOTO', file, dto.recipientName, actor);
  }

  @Post('shipments/:id/pod/signature')
  @ApiBearerAuth()
  @RequirePermissions('delivery.execute')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { recipientName: { type: 'string' }, file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file'))
  podSignature(@Param('id') id: string, @Body() dto: CapturePodMetaDto, @UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() actor: AuthenticatedUser) {
    if (!file) throw new BadRequestException('file is required');
    return this.shipments.capturePodFile(id, 'SIGNATURE', file, dto.recipientName, actor);
  }

  @Post('shipments/:id/resync-store')
  @ApiBearerAuth()
  @RequirePermissions('integrations.write')
  @ApiOperation({ summary: 'Re-queue the outbound fulfillment push to the originating store' })
  resyncStore(@Param('id') id: string) {
    return this.shipments.resyncStore(id);
  }

  // ---- Courier webhook (public) ----

  @Public()
  @Post('shipments/webhook/:courierCode/:shipmentId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Courier status callback (by courier code)' })
  webhook(
    @Param('courierCode') courierCode: string,
    @Param('shipmentId') shipmentId: string,
    @Body() payload: { status?: string },
    @Req() req: RawBodyRequest<Request>,
  ) {
    const signature = (req.headers['x-webhook-signature'] as string | undefined) ?? null;
    return this.shipments.webhook(courierCode, shipmentId, payload, req.rawBody, signature);
  }
}
