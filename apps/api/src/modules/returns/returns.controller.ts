import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ReturnStatus } from '@prisma/client';

import { ReturnsService } from './returns.service';
import { CreateReturnDto, InspectItemDto, PortalReturnDto } from './dto/returns-dtos';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

@ApiTags('returns')
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  // ---- Public Arabic-first customer portal ----
  @Public()
  @Get('portal/lookup')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Look up a delivered order for return (reference + phone)' })
  lookup(@Query('reference') reference: string, @Query('phone') phone: string) {
    return this.returns.lookupForPortal(reference, phone);
  }

  @Public()
  @Post('portal')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Customer return request (order reference + phone)' })
  portal(@Body() dto: PortalReturnDto) {
    return this.returns.createFromPortal(dto.orderReference, dto.customerPhone, dto.reason, dto.customerNote, dto.items);
  }

  // ---- Admin ----
  @Get()
  @ApiBearerAuth()
  @RequirePermissions('returns.read')
  @ApiQuery({ name: 'status', required: false, enum: ReturnStatus })
  @ApiQuery({ name: 'clientId', required: false })
  list(@Query('status') status?: ReturnStatus, @Query('clientId') clientId?: string) {
    return this.returns.list(status, clientId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @RequirePermissions('returns.read')
  get(@Param('id') id: string) {
    return this.returns.getById(id);
  }

  @Post()
  @ApiBearerAuth()
  @RequirePermissions('returns.write')
  create(@Body() dto: CreateReturnDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.returns.createAdmin(dto.orderId, dto.reason, dto.customerNote, dto.items, actor);
  }

  @Post(':id/approve')
  @ApiBearerAuth()
  @RequirePermissions('returns.write')
  approve(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.returns.approve(id, actor);
  }

  @Post(':id/reject')
  @ApiBearerAuth()
  @RequirePermissions('returns.write')
  reject(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.returns.reject(id, actor);
  }

  @Post(':id/received')
  @ApiBearerAuth()
  @RequirePermissions('returns.write')
  received(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.returns.markReceived(id, actor);
  }

  @Post('items/:itemId/inspect')
  @ApiBearerAuth()
  @RequirePermissions('returns.write')
  @ApiOperation({ summary: 'Disposition an item → restock (resellable) or quarantine (damaged)' })
  inspect(@Param('itemId') itemId: string, @Body() dto: InspectItemDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.returns.inspectItem(itemId, dto, actor);
  }

  @Post(':id/inspected')
  @ApiBearerAuth()
  @RequirePermissions('returns.write')
  inspected(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.returns.markInspected(id, actor);
  }

  @Post('items/:itemId/dispose')
  @ApiBearerAuth()
  @RequirePermissions('returns.write')
  @ApiOperation({ summary: 'Approve disposal of a damaged item (removes from quarantine)' })
  dispose(@Param('itemId') itemId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.returns.approveDisposal(itemId, actor);
  }

  @Post(':id/close')
  @ApiBearerAuth()
  @RequirePermissions('returns.write')
  @ApiOperation({ summary: 'Generate credit note + mark order RETURNED' })
  close(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.returns.close(id, actor);
  }
}
