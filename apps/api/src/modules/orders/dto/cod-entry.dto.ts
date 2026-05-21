import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CodLedgerType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CodEntryDto {
  @ApiProperty({ enum: CodLedgerType })
  @IsEnum(CodLedgerType)
  type!: CodLedgerType;

  @ApiProperty({ description: 'Amount in piastres' })
  @IsInt()
  @Min(0)
  amountPiastres!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
