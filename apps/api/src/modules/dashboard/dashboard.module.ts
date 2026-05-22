import { Module } from '@nestjs/common';

import { WmsModule } from '../wms/wms.module';
import { FinanceModule } from '../finance/finance.module';
import { ReportingModule } from '../reporting/reporting.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [WmsModule, FinanceModule, ReportingModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
