import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermissions('users.read')
  list() {
    return this.roles.list();
  }

  @Get(':id')
  @RequirePermissions('users.read')
  get(@Param('id') id: string) {
    return this.roles.getById(id);
  }
}
