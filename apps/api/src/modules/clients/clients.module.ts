import { Module } from '@nestjs/common';

import { ClientsService } from './clients.service';
import { ContractsService } from './contracts.service';
import { KycService } from './kyc.service';
import { PricingService } from './pricing.service';
import { PortalService } from './portal.service';
import { ClientsController } from './clients.controller';
import { ContractsController } from './contracts.controller';
import { PortalController } from './portal.controller';

@Module({
  providers: [ClientsService, ContractsService, KycService, PricingService, PortalService],
  controllers: [ClientsController, ContractsController, PortalController],
  exports: [ClientsService, ContractsService, PricingService],
})
export class ClientsModule {}
