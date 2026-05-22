import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationChannel, SmsProvider } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class SendNotificationDto {
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty({ description: 'Phone, email, or label' })
  @IsString()
  recipient!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 1000)
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ enum: SmsProvider })
  @IsOptional()
  @IsEnum(SmsProvider)
  provider?: SmsProvider;
}

export class DigestDto {
  @ApiProperty()
  @IsString()
  clientId!: string;
}
