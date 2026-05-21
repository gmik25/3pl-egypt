import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateRemittanceDto {
  @ApiPropertyOptional({ description: 'Driver id; defaults to the caller when omitted' })
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiProperty({ type: [String], description: 'Delivered COD order ids being remitted' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderIds!: string[];

  @ApiProperty({ description: 'Cash the driver declares depositing, in piastres' })
  @IsInt()
  @Min(0)
  declaredAmountPiastres!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class RejectRemittanceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
