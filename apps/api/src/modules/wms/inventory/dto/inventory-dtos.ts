import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, NotEquals } from 'class-validator';

export class AdjustStockDto {
  @ApiProperty()
  @IsString()
  skuId!: string;

  @ApiProperty()
  @IsString()
  locationId!: string;

  @ApiProperty({ description: 'Signed delta (positive adds, negative removes)' })
  @IsInt()
  @NotEquals(0)
  deltaQty!: number;

  @ApiPropertyOptional({ enum: StockStatus, default: 'AVAILABLE' })
  @IsOptional()
  @IsEnum(StockStatus)
  status?: StockStatus;

  @ApiPropertyOptional({ description: 'Lot number (for expiry-tracked SKUs)' })
  @IsOptional()
  @IsString()
  lotNumber?: string;

  @ApiPropertyOptional({ description: 'ISO date' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class TransferStockDto {
  @ApiProperty() @IsString() skuId!: string;
  @ApiProperty() @IsString() fromLocationId!: string;
  @ApiProperty() @IsString() toLocationId!: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) quantity!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() lotId?: string;
  @ApiPropertyOptional({ enum: StockStatus, default: 'AVAILABLE' }) @IsOptional() @IsEnum(StockStatus) status?: StockStatus;
}

export class ChangeStatusDto {
  @ApiProperty() @IsString() skuId!: string;
  @ApiProperty() @IsString() locationId!: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) quantity!: number;
  @ApiProperty({ enum: StockStatus, description: 'Move FROM this status' }) @IsEnum(StockStatus) fromStatus!: StockStatus;
  @ApiProperty({ enum: StockStatus, description: 'Move TO this status' }) @IsEnum(StockStatus) toStatus!: StockStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() lotId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
