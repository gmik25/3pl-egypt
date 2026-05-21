import { Module } from '@nestjs/common';

import { CatalogService } from './catalog/catalog.service';
import { CatalogController } from './catalog/catalog.controller';
import { LocationsService } from './locations/locations.service';
import { LocationsController } from './locations/locations.controller';
import { InventoryService } from './inventory/inventory.service';
import { InventoryController } from './inventory/inventory.controller';
import { InboundService } from './inbound/inbound.service';
import { InboundController } from './inbound/inbound.controller';
import { CountingService } from './counting/counting.service';
import { CountingController } from './counting/counting.controller';

@Module({
  providers: [
    CatalogService,
    LocationsService,
    InventoryService,
    InboundService,
    CountingService,
  ],
  controllers: [
    CatalogController,
    LocationsController,
    InventoryController,
    InboundController,
    CountingController,
  ],
  // InventoryService is consumed by OMS routing for stock-aware warehouse selection.
  exports: [InventoryService],
})
export class WmsModule {}
