import { Module } from '@nestjs/common';

import { OrdersModule } from '../orders/orders.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DriversService } from './drivers/drivers.service';
import { DriversController } from './drivers/drivers.controller';
import { ShipmentsService } from './shipments/shipments.service';
import { ShipmentsController } from './shipments/shipments.controller';

@Module({
  // OMS order transitions on dispatch/delivery; Notifications for customer delivery messages.
  imports: [OrdersModule, NotificationsModule],
  providers: [DriversService, ShipmentsService],
  controllers: [DriversController, ShipmentsController],
})
export class FleetModule {}
