import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GovernorateCode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateCourierDto {
  @ApiProperty({ example: 'JANDT', description: 'Stable short code (uppercase)' })
  @Matches(/^[A-Z0-9_]{2,20}$/, { message: 'code must be 2–20 uppercase letters/digits' })
  code!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiBaseUrl?: string;

  @ApiPropertyOptional({ description: 'Stored encrypted; never returned' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'For inbound webhook HMAC; stored encrypted' })
  @IsOptional()
  @IsString()
  webhookSecret?: string;
}

export class UpdateCourierDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() apiBaseUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ description: 'Rotate API key (encrypted)' }) @IsOptional() @IsString() apiKey?: string;
  @ApiPropertyOptional({ description: 'Rotate webhook secret (encrypted)' }) @IsOptional() @IsString() webhookSecret?: string;
}

export class CoverageEntryDto {
  @ApiProperty({ enum: GovernorateCode })
  @IsEnum(GovernorateCode)
  governorate!: GovernorateCode;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  etaDays!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isServiceable?: boolean;
}

export class SetCoverageDto {
  @ApiProperty({ type: [CoverageEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CoverageEntryDto)
  entries!: CoverageEntryDto[];
}
