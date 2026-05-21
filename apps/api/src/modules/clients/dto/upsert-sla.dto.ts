import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class UpsertSlaDto {
  @ApiProperty({ description: 'Max handling time before dispatch, in minutes' })
  @IsInt()
  @Min(0)
  handlingTimeMinutes!: number;

  @ApiProperty({ description: 'Delivery window for Cairo/Giza orders, in days' })
  @IsInt()
  @Min(0)
  deliveryWindowDaysCairo!: number;

  @ApiProperty({ description: 'Delivery window for other governorates, in days' })
  @IsInt()
  @Min(0)
  deliveryWindowDaysOther!: number;

  @ApiProperty({ description: 'Max acceptable return rate, in basis points (500 = 5.00%)' })
  @IsInt()
  @Min(0)
  @Max(10_000)
  maxReturnRateBps!: number;
}
