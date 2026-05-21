import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateContractDto {
  @ApiProperty({ description: 'ISO date the contract starts' })
  @IsDateString()
  startsOn!: string;

  @ApiPropertyOptional({ description: 'ISO date the contract ends (open-ended if omitted)' })
  @IsOptional()
  @IsDateString()
  endsOn?: string;

  // EG: all monetary fields are integer piastres (1 EGP = 100 piastres).
  @ApiProperty({ description: 'Storage fee per SKU per day, in piastres' })
  @IsInt()
  @Min(0)
  storagePerSkuPerDayPiastres!: number;

  @ApiProperty({ description: 'Pick & pack fee per order, in piastres' })
  @IsInt()
  @Min(0)
  pickAndPackPiastres!: number;

  @ApiProperty({ description: 'COD commission, in basis points (250 = 2.50%)' })
  @IsInt()
  @Min(0)
  @Max(10_000)
  codCommissionBps!: number;

  @ApiProperty({ description: 'Return processing fee per order, in piastres' })
  @IsInt()
  @Min(0)
  returnFeePiastres!: number;
}
