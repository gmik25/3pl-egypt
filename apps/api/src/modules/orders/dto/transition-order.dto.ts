import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderState } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class TransitionOrderDto {
  @ApiProperty({ enum: OrderState, description: 'Target state (must be a valid transition)' })
  @IsEnum(OrderState)
  toState!: OrderState;

  @ApiPropertyOptional({ description: 'Reason / note (required for FAILED and RETURNED)' })
  @IsOptional()
  @IsString()
  reason?: string;
}
