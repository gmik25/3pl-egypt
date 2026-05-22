import { Module } from '@nestjs/common';

import { WmsModule } from '../wms/wms.module';
import { CustomsService } from './customs.service';
import { CustomsController } from './customs.controller';

@Module({
  imports: [WmsModule], // release receives cleared goods into stock via InventoryService
  providers: [CustomsService],
  controllers: [CustomsController],
})
export class CustomsModule {}
