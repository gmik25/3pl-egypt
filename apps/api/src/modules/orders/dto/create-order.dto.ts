import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GovernorateCode, PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @ApiProperty({ description: 'Client-scoped SKU code (auto-created if unknown)' })
  @IsString()
  @Length(1, 64)
  skuCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: 'Unit price in piastres' })
  @IsInt()
  @Min(0)
  unitPricePiastres!: number;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsString()
  clientId!: string;

  @ApiPropertyOptional({ description: 'Pin to a specific warehouse; otherwise auto-routed' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'External system reference' })
  @IsOptional()
  @IsString()
  externalRef?: string;

  @ApiProperty()
  @IsString()
  @Length(2, 120)
  customerName!: string;

  @ApiProperty({ example: '+201001234567' })
  @Matches(/^\+?[0-9]{7,15}$/)
  customerPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\+?[0-9]{7,15}$/)
  customerPhoneAlt?: string;

  // EG: full Egyptian address — no postcode.
  @ApiPropertyOptional() @IsOptional() @IsString() addressApartment?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressFloor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressBuilding?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressStreet?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressDistrict?: string;

  @ApiProperty({ enum: GovernorateCode })
  @IsEnum(GovernorateCode)
  governorate!: GovernorateCode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ description: 'COD amount in piastres; required when paymentMethod=COD' })
  @IsOptional()
  @IsInt()
  @Min(0)
  codAmountPiastres?: number;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
