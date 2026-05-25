import { Module } from '@nestjs/common';

import { OrdersModule } from '../orders/orders.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StoreSyncModule } from '../integrations/store-sync.module';
import { DriversService } from './drivers/drivers.service';
import { DriversController } from './drivers/drivers.controller';
import { ShipmentsService } from './shipments/shipments.service';
import { ShipmentsController } from './shipments/shipments.controller';

@Module({
  // OMS order transitions on dispatch/delivery; Notifications for customer delivery messages;
  // StoreSync pushes fulfillment/tracking back to the originating e-commerce platform.
  imports: [OrdersModule, NotificationsModule, StoreSyncModule],
  providers: [DriversService, ShipmentsService],
  controllers: [DriversController, ShipmentsController],
})
export class FleetModule {}
