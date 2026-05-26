import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { LocationsService } from './locations.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../common/types/authenticated-request';

/**
 * Seller self-serve view of their warehouse footprint. EG: ownership is resolved from the token —
 * a CLIENT user sees only the locations allocated to their own client.
 */
@ApiTags('portal-warehouse')
@ApiBearerAuth()
@Controller('portal/warehouse')
export class PortalWarehouseController {
  constructor(private readonly locations: LocationsService) {}

  @Get('allocations')
  @ApiOperation({ summary: "The signed-in seller's allocated storage locations, grouped by warehouse" })
  myAllocations(@CurrentUser() user: AuthenticatedUser) {
    return this.locations.myAllocations(user.id);
  }
}
