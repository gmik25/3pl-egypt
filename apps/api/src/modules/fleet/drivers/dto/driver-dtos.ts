import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GovernorateCode } from '@prisma/client';
import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class RegisterDriverDto {
  @ApiProperty({ description: 'Existing user (DRIVER role) to attach a fleet profile to' })
  @IsString()
  userId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plateNumber?: string;

  @ApiPropertyOptional({ enum: GovernorateCode, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(GovernorateCode, { each: true })
  zones?: GovernorateCode[];
}

export class UpdateDriverDto {
  @ApiPropertyOptional() @IsOptional() @IsString() vehicleType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() plateNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isAvailable?: boolean;

  @ApiPropertyOptional({ enum: GovernorateCode, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(GovernorateCode, { each: true })
  zones?: GovernorateCode[];
}
