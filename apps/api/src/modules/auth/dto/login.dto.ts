import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@3pl-egypt.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ChangeMe!2026', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    description: '6-digit TOTP code, required when MFA is enrolled.',
    example: '123456',
  })
  @IsOptional()
  @IsString()
  @Length(6, 8)
  mfaCode?: string;

  @ApiPropertyOptional({ description: 'Label for this session (device name).' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  deviceLabel?: string;
}
