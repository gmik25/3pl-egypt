import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';

import { AuditService } from './audit.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('audit.read')
  @ApiQuery({ name: 'userId',   required: false })
  @ApiQuery({ name: 'action',   required: false, enum: AuditAction })
  @ApiQuery({ name: 'entity',   required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'from',     required: false, type: String, description: 'ISO 8601' })
  @ApiQuery({ name: 'to',       required: false, type: String, description: 'ISO 8601' })
  @ApiQuery({ name: 'page',     required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  list(
    @Query('userId')   userId?: string,
    @Query('action')   action?: AuditAction,
    @Query('entity')   entity?: string,
    @Query('entityId') entityId?: string,
    @Query('from')     from?: string,
    @Query('to')       to?: string,
    @Query('page')     page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.audit.list({
      userId,
      action,
      entity,
      entityId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }
}
