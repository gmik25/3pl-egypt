import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PortalService } from './portal.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

@ApiTags('portal')
@ApiBearerAuth()
@Controller('portal')
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get('me')
  @ApiOperation({ summary: "The signed-in client user's own client record" })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.portal.getMyClient(user.id);
  }

  @Get('me/contracts')
  @ApiOperation({ summary: "The signed-in client user's own contracts + SLAs" })
  contracts(@CurrentUser() user: AuthenticatedUser) {
    return this.portal.getMyContracts(user.id);
  }
}
