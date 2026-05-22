import { Module } from '@nestjs/common';

import { WmsModule } from '../wms/wms.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [WmsModule], // InventoryService for low-stock alert checks
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService], // consumed by Fleet (delivery events)
})
export class NotificationsModule {}
