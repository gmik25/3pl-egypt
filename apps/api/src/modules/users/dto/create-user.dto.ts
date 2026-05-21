import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRoleName, GovernorateCode } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: 'E.164 phone, optional', example: '+201001234567' })
  @IsOptional()
  // EG: Egyptian mobile prefixes (010/011/012/015) — keep loose to support landlines too.
  @Matches(/^\+?[0-9]{7,15}$/)
  phone?: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 100)
  fullName!: string;

  @ApiPropertyOptional({ enum: UserRoleName, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(UserRoleName, { each: true })
  roles?: UserRoleName[];

  @ApiPropertyOptional({
    enum: GovernorateCode,
    isArray: true,
    description: 'Empty/omitted = no scope restriction',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(GovernorateCode, { each: true })
  scopedGovernorates?: GovernorateCode[];

  @ApiPropertyOptional({ description: 'For CLIENT-role users, the client they belong to' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
