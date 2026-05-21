import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GovernorateCode, LocationType, ZoneType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';

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
}
