import { Module } from '@nestjs/common';
import { CouriersService } from './couriers.service';
import { CouriersController } from './couriers.controller';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [OrdersModule], // StoresService delegates inbound order webhooks to IntakeService
  providers: [CouriersService, StoresService],
  controllers: [CouriersController, StoresController],
})
export class IntegrationsModule {}
