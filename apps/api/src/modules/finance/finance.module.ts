import { Module } from '@nestjs/common';

import { WalletService } from './wallet.service';
import { RemittanceService } from './remittance.service';
import { PayoutService } from './payout.service';
import { InvoiceService } from './invoice.service';
import { FinanceController } from './finance.controller';
import { RemittanceController } from './remittance.controller';
import { PayoutController } from './payout.controller';
import { InvoiceController } from './invoice.controller';

@Module({
  providers: [WalletService, RemittanceService, PayoutService, InvoiceService],
  controllers: [FinanceController, RemittanceController, PayoutController, InvoiceController],
  exports: [WalletService],
})
export class FinanceModule {}
