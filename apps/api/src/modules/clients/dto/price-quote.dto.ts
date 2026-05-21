import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * Inputs for a what-if price quote against a contract's pricing.
 * The engine multiplies these by the contract's rates and adds 14% VAT.
 */
export class PriceQuoteDto {
  @ApiPropertyOptional({ description: 'Number of distinct SKUs stored', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  skuCount?: number;

  @ApiPropertyOptional({ description: 'Storage duration, in days', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  storageDays?: number;

  @ApiPropertyOptional({ description: 'Number of orders picked & packed', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderCount?: number;

  @ApiPropertyOptional({ description: 'Total COD collected across orders, in piastres', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  codAmountPiastres?: number;

  @ApiPropertyOptional({ description: 'Number of returns processed', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  returnCount?: number;
}
