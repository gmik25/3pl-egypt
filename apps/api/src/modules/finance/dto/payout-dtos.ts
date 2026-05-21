import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayoutRail } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePayoutDto {
  @ApiProperty()
  @IsString()
  clientId!: string;

  @ApiProperty({ description: 'Amount in piastres' })
  @IsInt()
  @Min(1)
  amountPiastres!: number;

  @ApiProperty({ enum: PayoutRail })
  @IsEnum(PayoutRail)
  rail!: PayoutRail;

  @ApiPropertyOptional({ description: 'External transfer reference' })
  @IsOptional()
  @IsString()
  externalRef?: string;
}

export class MarkPaidDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalRef?: string;
}
