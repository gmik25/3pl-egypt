import { ApiProperty } from '@nestjs/swagger';
import { StorePlatform } from '@prisma/client';
import { IsEnum, IsString, Length, Matches } from 'class-validator';

export class ConnectStoreDto {
  @ApiProperty()
  @IsString()
  clientId!: string;

  @ApiProperty({ enum: StorePlatform })
  @IsEnum(StorePlatform)
  platform!: StorePlatform;

  // EG: store host only (no scheme/path). e.g. acme.myshopify.com, acme.salla.sa
  @ApiProperty({ example: 'acme.myshopify.com', description: 'Store host (no https://)' })
  @Matches(/^[a-z0-9.-]{3,120}$/i, { message: 'shopDomain must be a bare host, e.g. acme.myshopify.com' })
  @Length(3, 120)
  shopDomain!: string;
}
