import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// EG: transient receiving outcome — drives stock status, not persisted as its own column.
export enum InspectionResult {
  PASS = 'PASS',
  DAMAGED = 'DAMAGED',
  REJECTED = 'REJECTED',
}

import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PoLineDto {
  @ApiProperty() @IsString() skuId!: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) quantityOrdered!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() lotNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
}

export class CreatePurchaseOrderDto {
  @ApiProperty() @IsString() clientId!: string;
  @ApiProperty() @IsString() warehouseId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supplierName?: string;
  @ApiPropertyOptional({ description: 'ISO date' }) @IsOptional() @IsDateString() expectedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiProperty({ type: [PoLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PoLineDto)
  lines!: PoLineDto[];
}

export class ReceiveLineDto {
  @ApiProperty({ description: 'PoLine to receive against' })
  @IsString()
  poLineId!: string;

  @ApiProperty({ description: 'Location to receive into (typically a RECEIVING-zone bin)' })
  @IsString()
  locationId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ enum: InspectionResult, description: 'PASS→available, DAMAGED→quarantine, REJECTED→not stocked' })
  @IsEnum(InspectionResult)
  inspection!: InspectionResult;

  @ApiPropertyOptional() @IsOptional() @IsString() lotNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
