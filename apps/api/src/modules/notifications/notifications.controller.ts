import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { NotificationCategory, NotificationChannel, NotificationStatus } from '@prisma/client';

import { NotificationsService } from './notifications.service';
import { DigestDto, SendNotificationDto } from './dto/notifications-dtos';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions('notifications.read')
  @ApiQuery({ name: 'channel', required: false, enum: NotificationChannel })
  @ApiQuery({ name: 'category', required: false, enum: NotificationCategory })
  @ApiQuery({ name: 'status', required: false, enum: NotificationStatus })
  list(
    @Query('channel') channel?: NotificationChannel,
    @Query('category') category?: NotificationCategory,
    @Query('status') status?: NotificationStatus,
  ) {
    return this.notifications.list({ channel, category, status });
  }

  @Post('send')
  @RequirePermissions('notifications.send')
  @ApiOperation({ summary: 'Send a message (SMS / WhatsApp / email / internal)' })
  send(@Body() dto: SendNotificationDto) {
    return this.notifications.send({ channel: dto.channel, recipient: dto.recipient, body: dto.body, subject: dto.subject, provider: dto.provider });
  }

  @Post('run-alerts')
  @RequirePermissions('notifications.send')
  @ApiOperation({ summary: 'Run alert checks: low stock, SLA breach, failed-delivery spike' })
  runAlerts() {
    return this.notifications.runAlertChecks();
  }

  @Post('digest')
  @RequirePermissions('notifications.send')
  @ApiOperation({ summary: 'Generate + send a client digest' })
  digest(@Body() dto: DigestDto) {
    return this.notifications.generateClientDigest(dto.clientId);
  }
}
