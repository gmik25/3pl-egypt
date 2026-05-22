import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { DashboardService } from './dashboard.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('portal')
  @ApiOperation({ summary: "The signed-in client user's self-service dashboard" })
  portal(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.portalSummary(user.id);
  }

  @Get('ops')
  @RequirePermissions('reports.read')
  @ApiOperation({ summary: 'Operations command center — all clients, warehouses, couriers, queues, alerts' })
  ops() {
    return this.dashboard.opsOverview();
  }
}
