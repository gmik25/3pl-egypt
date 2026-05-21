import { Module } from '@nestjs/common';

import { WmsModule } from '../wms/wms.module';
import { OrdersModule } from '../orders/orders.module';
import { ReturnsService } from './returns.service';
import { ReturnsController } from './returns.controller';

@Module({
  // WMS InventoryService for restock/quarantine/disposal; OMS OrdersService for order → RETURNED.
  imports: [WmsModule, OrdersModule],
  providers: [ReturnsService],
  controllers: [ReturnsController],
})
export class ReturnsModule {}
