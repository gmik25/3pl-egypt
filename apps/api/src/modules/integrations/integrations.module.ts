import { Module } from '@nestjs/common';
import { CouriersService } from './couriers.service';
import { CouriersController } from './couriers.controller';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';
import { PortalStoresController } from './portal-stores.controller';
import { OrdersModule } from '../orders/orders.module';
import { StoreSyncModule } from './store-sync.module';

@Module({
  // OrdersModule: StoresService delegates inbound webhooks to IntakeService.
  // StoreSyncModule: backfill producer for the connect-time historical pull.
  imports: [OrdersModule, StoreSyncModule],
  providers: [CouriersService, StoresService],
  controllers: [CouriersController, StoresController, PortalStoresController],
})
export class IntegrationsModule {}
