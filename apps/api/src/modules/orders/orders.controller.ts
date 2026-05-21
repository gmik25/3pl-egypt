import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GovernorateCode, OrderState } from '@prisma/client';

import { OrdersService } from './orders.service';
import { CodService } from './cod.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { TransitionOrderDto } from './dto/transition-order.dto';
import { CodEntryDto } from './dto/cod-entry.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly cod: CodService,
  ) {}

  @Get()
  @RequirePermissions('orders.read')
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'state', required: false, enum: OrderState })
  @ApiQuery({ name: 'governorate', required: false, enum: GovernorateCode })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'flaggedOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('clientId') clientId?: string,
    @Query('state') state?: OrderState,
    @Query('governorate') governorate?: GovernorateCode,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('flaggedOnly') flaggedOnly?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.orders.list(
      {
        clientId,
        state,
        governorate,
        search,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        flaggedOnly: flaggedOnly === 'true',
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      },
      actor,
    );
  }

  @Get(':id')
  @RequirePermissions('orders.read')
  get(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.orders.getById(id, actor);
  }

  @Post()
  @RequirePermissions('orders.write')
  @ApiOperation({ summary: 'Create an order manually' })
  create(@Body() dto: CreateOrderDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.orders.create(dto, actor);
  }

  @Post(':id/transition')
  @RequirePermissions('orders.transition')
  @ApiOperation({ summary: 'Advance an order to the next state (validated against the state machine)' })
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionOrderDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.orders.transition(id, dto.toState, dto.reason, actor);
  }

  // ---- COD ----

  @Get(':id/cod')
  @RequirePermissions('orders.read')
  codForOrder(@Param('id') id: string) {
    return this.cod.listForOrder(id);
  }

  @Post(':id/cod')
  @RequirePermissions('orders.transition')
  @ApiOperation({ summary: 'Record a COD ledger entry (collection / remittance / adjustment)' })
  addCod(@Param('id') id: string, @Body() dto: CodEntryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.cod.addEntry(id, dto.type, dto.amountPiastres, actor.id, dto.note);
  }

  @Get('cod/summary')
  @RequirePermissions('orders.read')
  @ApiQuery({ name: 'clientId', required: false })
  codSummary(@Query('clientId') clientId?: string) {
    return this.cod.summary(clientId);
  }
}
