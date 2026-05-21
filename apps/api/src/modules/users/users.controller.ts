import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GovernorateCode, UserRoleName } from '@prisma/client';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Return the current authenticated user' })
  async me(@CurrentUser() u: AuthenticatedUser) {
    return this.users.getById(u.id);
  }

  @Get()
  @RequirePermissions('users.read')
  @ApiQuery({ name: 'role',        required: false, enum: UserRoleName })
  @ApiQuery({ name: 'governorate', required: false, enum: GovernorateCode })
  @ApiQuery({ name: 'search',      required: false })
  @ApiQuery({ name: 'isActive',    required: false, type: Boolean })
  @ApiQuery({ name: 'page',        required: false, type: Number })
  @ApiQuery({ name: 'pageSize',    required: false, type: Number })
  list(
    @Query('role')        role?: UserRoleName,
    @Query('governorate') governorate?: GovernorateCode,
    @Query('search')      search?: string,
    @Query('isActive')    isActive?: string,
    @Query('page')        page?: string,
    @Query('pageSize')    pageSize?: string,
  ) {
    return this.users.list({
      role,
      governorate,
      search,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      page:     page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('users.read')
  get(@Param('id') id: string) {
    return this.users.getById(id);
  }

  @Post()
  @RequirePermissions('users.write')
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.create(dto, actor.id);
  }

  @Patch(':id')
  @RequirePermissions('users.write')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.update(id, dto, actor.id);
  }

  @Delete(':id')
  @RequirePermissions('users.write')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    await this.users.deactivate(id, actor.id);
  }

  @Post(':id/roles')
  @RequirePermissions('users.write')
  async assignRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.users.assignRole(id, dto.role, actor.id);
    return this.users.getById(id);
  }

  @Delete(':id/roles/:roleId')
  @RequirePermissions('users.write')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.users.revokeRole(id, roleId, actor.id);
  }
}
