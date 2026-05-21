import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString } from 'class-validator';

export class GenerateInvoiceDto {
  @ApiProperty()
  @IsString()
  clientId!: string;

  @ApiProperty({ description: 'ISO date (inclusive)' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ description: 'ISO date (inclusive)' })
  @IsDateString()
  periodEnd!: string;
}
