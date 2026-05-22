import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export class HsCodeDto {
  @ApiProperty({ example: '6109.10' })
  @IsString()
  @Length(2, 20)
  code!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 200)
  description!: string;

  @ApiProperty({ description: 'Duty rate in basis points (1400 = 14%)' })
  @IsInt()
  @Min(0)
  dutyRateBps!: number;
}

export class ImportLineDto {
  @ApiProperty()
  @IsString()
  skuId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: 'FOB unit cost in piastres' })
  @IsInt()
  @Min(0)
  unitCostPiastres!: number;

  @ApiPropertyOptional({ description: 'Override HS code; otherwise taken from the SKU' })
  @IsOptional()
  @IsString()
  hsCode?: string;
}

export class CreateImportShipmentDto {
  @ApiProperty()
  @IsString()
  clientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierName?: string;

  @ApiPropertyOptional({ description: 'Freight cost in piastres' })
  @IsOptional()
  @IsInt()
  @Min(0)
  freightCostPiastres?: number;

  @ApiPropertyOptional({ description: 'Insurance cost in piastres' })
  @IsOptional()
  @IsInt()
  @Min(0)
  insuranceCostPiastres?: number;

  @ApiPropertyOptional({ description: 'Goods held in a bonded zone (duty deferred until release)' })
  @IsOptional()
  @IsBoolean()
  bonded?: boolean;

  @ApiProperty({ type: [ImportLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportLineDto)
  lines!: ImportLineDto[];
}

export class DeclareDto {
  @ApiProperty({ description: 'Egyptian Customs Authority declaration number' })
  @IsString()
  @Length(1, 60)
  ecaDeclarationNumber!: string;
}

export class ReleaseDto {
  @ApiProperty({ description: 'Warehouse location to receive the cleared goods into' })
  @IsString()
  locationId!: string;
}
