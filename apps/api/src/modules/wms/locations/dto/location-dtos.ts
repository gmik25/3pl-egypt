import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GovernorateCode, LocationType, ZoneType } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty({ example: 'CAI-2' })
  @IsString()
  @Length(2, 20)
  code!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({ enum: GovernorateCode })
  @IsEnum(GovernorateCode)
  governorate!: GovernorateCode;
}

export class UpdateWarehouseDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 120) name?: string;
  @ApiPropertyOptional({ enum: GovernorateCode }) @IsOptional() @IsEnum(GovernorateCode) governorate?: GovernorateCode;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateZoneDto {
  @ApiProperty({ enum: ZoneType })
  @IsEnum(ZoneType)
  type!: ZoneType;

  @ApiProperty({ example: 'STG' })
  @IsString()
  @Length(1, 20)
  code!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 80)
  name!: string;
}

export class CreateLocationDto {
  @ApiProperty({ description: 'Zone the location belongs to' })
  @IsString()
  zoneId!: string;

  @ApiProperty({ example: 'STG-07' })
  @IsString()
  @Length(1, 40)
  code!: string;

  @ApiPropertyOptional({ enum: LocationType, default: 'BIN' })
  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @ApiPropertyOptional({ description: 'Scannable location barcode' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9\-_.]{1,60}$/)
  barcode?: string;

  @ApiPropertyOptional({ description: 'Max units this bin holds (for utilisation)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  capacityUnits?: number;
}

/**
 * Bulk-generate a storage grid: the cartesian product of aisles × racks × levels × bins.
 * Each location's code is composed as `aisle-rack-level-bin` (e.g. A-01-3-05).
 */
export class BulkGenerateLocationsDto {
  @ApiProperty()
  @IsString()
  zoneId!: string;

  @ApiPropertyOptional({ enum: LocationType, default: 'BIN' })
  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;

  @ApiProperty({ type: [String], example: ['A', 'B'] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsString({ each: true }) @Matches(/^[A-Za-z0-9]{1,8}$/, { each: true })
  aisles!: string[];

  @ApiProperty({ type: [String], example: ['01', '02', '03'] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsString({ each: true }) @Matches(/^[A-Za-z0-9]{1,8}$/, { each: true })
  racks!: string[];

  @ApiProperty({ type: [String], example: ['1', '2', '3'] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsString({ each: true }) @Matches(/^[A-Za-z0-9]{1,8}$/, { each: true })
  levels!: string[];

  @ApiProperty({ type: [String], example: ['01', '02'] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsString({ each: true }) @Matches(/^[A-Za-z0-9]{1,8}$/, { each: true })
  bins!: string[];

  @ApiPropertyOptional({ description: 'Reserve the whole generated section for this seller' })
  @IsOptional()
  @IsString()
  allocatedClientId?: string;

  @ApiPropertyOptional({ description: 'Max units each generated bin holds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  capacityUnits?: number;
}

/** Allocate (or release) a set of locations to a seller. clientId = null releases them. */
export class AllocateLocationsDto {
  @ApiPropertyOptional({ description: 'Seller to reserve for; null/omitted releases the allocation' })
  @IsOptional()
  @IsString()
  clientId?: string | null;

  @ApiProperty({ type: [String] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5000) @IsString({ each: true })
  locationIds!: string[];
}
