import { ApiPropertyOptional } from '@nestjs/swagger';
import { GovernorateCode } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\+?[0-9]{7,15}$/)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 100)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: GovernorateCode, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(GovernorateCode, { each: true })
  scopedGovernorates?: GovernorateCode[];

  @ApiPropertyOptional({ minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
