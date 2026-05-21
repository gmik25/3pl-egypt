import { Module } from '@nestjs/common';

import { OrdersModule } from '../orders/orders.module';
import { DriversService } from './drivers/drivers.service';
import { DriversController } from './drivers/drivers.controller';
import { ShipmentsService } from './shipments/shipments.service';
import { ShipmentsController } from './shipments/shipments.controller';

@Module({
  imports: [OrdersModule], // ShipmentsService drives OMS order transitions on dispatch/delivery
  providers: [DriversService, ShipmentsService],
  controllers: [DriversController, ShipmentsController],
})
export class FleetModule {}
