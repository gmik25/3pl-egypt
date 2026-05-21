import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { WalletService } from './wallet.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('finance')
@ApiBearerAuth()
@Controller('finance')
export class FinanceController {
  constructor(private readonly wallet: WalletService) {}

  @Get('wallets/:clientId')
  @RequirePermissions('finance.read')
  @ApiOperation({ summary: "A client's wallet + balance" })
  wallet_(@Param('clientId') clientId: string) {
    return this.wallet.getByClient(clientId);
  }

  @Get('wallets/:clientId/statement')
  @RequirePermissions('finance.read')
  @ApiOperation({ summary: 'Statement of account (ledger with running balance)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  statement(
    @Param('clientId') clientId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.wallet.statement(clientId, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
  }
}
