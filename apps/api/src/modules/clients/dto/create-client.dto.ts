import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GovernorateCode } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ example: 'شركة المثال للتجارة' })
  @IsString()
  @Length(2, 200)
  legalName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 200)
  tradingName?: string;

  @ApiPropertyOptional({ description: 'ETA tax registration number' })
  @IsOptional()
  @IsString()
  @Length(3, 50)
  taxId?: string;

  @ApiPropertyOptional({ description: 'Commercial registration number' })
  @IsOptional()
  @IsString()
  @Length(3, 50)
  commercialRegistration?: string;

  @ApiProperty()
  @IsString()
  @Length(2, 100)
  contactName!: string;

  @ApiProperty()
  @IsEmail()
  contactEmail!: string;

  @ApiProperty({ example: '+201001234567' })
  @Matches(/^\+?[0-9]{7,15}$/)
  contactPhone!: string;

  // EG: full Egyptian address breakdown — no postcode (rural areas often lack one).
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressApartment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressFloor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressBuilding?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressStreet?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressDistrict?: string;

  @ApiProperty({ enum: GovernorateCode })
  @IsEnum(GovernorateCode)
  governorate!: GovernorateCode;
}
