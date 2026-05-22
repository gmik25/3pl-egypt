import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

export class CreateSkuDto {
  @ApiProperty()
  @IsString()
  clientId!: string;

  @ApiProperty({ description: 'Client-scoped SKU code', example: 'TSHIRT-RED-L' })
  @IsString()
  @Length(1, 64)
  code!: string;

  @ApiProperty({ example: 'تيشيرت أحمر مقاس L' })
  @IsString()
  @Length(1, 200)
  nameAr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  nameEn?: string;

  @ApiPropertyOptional({ description: 'EAN-13 / EAN-8 / UPC barcode (8–14 digits)' })
  @IsOptional()
  // EG: EAN-13 is standard on retail goods; allow 8–14 digits to cover EAN-8/UPC.
  @Matches(/^\d{8,14}$/, { message: 'barcode must be 8–14 digits' })
  barcode?: string;

  @ApiPropertyOptional({ description: 'HS tariff code (for customs duty on imports)', example: '6109.10' })
  @IsOptional()
  @IsString()
  @Length(2, 20)
  hsCode?: string;

  @ApiPropertyOptional({ default: 'EA' })
  @IsOptional()
  @IsString()
  @Length(1, 10)
  unitOfMeasure?: string;

  @ApiPropertyOptional({ default: false, description: 'Track lots + expiry (enables FEFO)' })
  @IsOptional()
  @IsBoolean()
  expiryTracked?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderPointQty?: number;

  @ApiPropertyOptional({ default: 0, description: 'Default unit price in piastres' })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultUnitPricePiastres?: number;
}
