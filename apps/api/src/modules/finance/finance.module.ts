import { Module } from '@nestjs/common';

import { WalletService } from './wallet.service';
import { RemittanceService } from './remittance.service';
import { PayoutService } from './payout.service';
import { InvoiceService } from './invoice.service';
import { StorageBillingService } from './storage-billing.service';
import { FinanceController } from './finance.controller';
import { RemittanceController } from './remittance.controller';
import { PayoutController } from './payout.controller';
import { InvoiceController } from './invoice.controller';
import { StorageBillingController } from './storage-billing.controller';

@Module({
  providers: [WalletService, RemittanceService, PayoutService, InvoiceService, StorageBillingService],
  controllers: [FinanceController, RemittanceController, PayoutController, InvoiceController, StorageBillingController],
  exports: [WalletService],
})
export class FinanceModule {}
