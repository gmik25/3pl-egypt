import { ApiProperty } from '@nestjs/swagger';
import { KycDocType } from '@prisma/client';
import { IsBoolean, IsEnum } from 'class-validator';

export class UploadKycDto {
  @ApiProperty({ enum: KycDocType })
  @IsEnum(KycDocType)
  type!: KycDocType;
}

export class ReviewKycDto {
  @ApiProperty({ description: 'true = approved, false = rejected' })
  @IsBoolean()
  approved!: boolean;
}
