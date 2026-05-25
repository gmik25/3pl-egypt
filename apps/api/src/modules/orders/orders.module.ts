import { Module } from '@nestjs/common';

import { OrdersService } from './orders.service';
import { RoutingService } from './routing.service';
import { OrderValidationService } from './order-validation.service';
import { CodService } from './cod.service';
import { IntakeService } from './intake/intake.service';
import { OrdersController } from './orders.controller';
import { IntakeController } from './intake/intake.controller';
import { WmsModule } from '../wms/wms.module';

@Module({
  imports: [WmsModule], // RoutingService consults InventoryService for stock-aware routing
  providers: [OrdersService, RoutingService, OrderValidationService, CodService, IntakeService],
  controllers: [OrdersController, IntakeController],
  exports: [OrdersService, CodService, IntakeService],
})
export class OrdersModule {}
