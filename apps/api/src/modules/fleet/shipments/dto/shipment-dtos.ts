import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CarrierType, CourierName, DeliveryFailureReason } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length, ValidateIf } from 'class-validator';

export class CreateShipmentDto {
  @ApiProperty()
  @IsString()
  orderId!: string;

  @ApiProperty({ enum: CarrierType })
  @IsEnum(CarrierType)
  carrierType!: CarrierType;

  @ApiPropertyOptional({ enum: CourierName, description: 'Required when carrierType=COURIER' })
  @ValidateIf((o) => o.carrierType === CarrierType.COURIER)
  @IsEnum(CourierName)
  courier?: CourierName;

  @ApiPropertyOptional({ description: 'Driver user id; required when carrierType=IN_HOUSE' })
  @ValidateIf((o) => o.carrierType === CarrierType.IN_HOUSE)
  @IsString()
  driverId?: string;
}

export class RecordFailedAttemptDto {
  @ApiProperty({ enum: DeliveryFailureReason })
  @IsEnum(DeliveryFailureReason)
  failureReason!: DeliveryFailureReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CapturePodOtpDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipientName?: string;
}

export class CapturePodMetaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipientName?: string;
}
