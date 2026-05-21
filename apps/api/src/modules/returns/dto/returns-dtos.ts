import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReturnDisposition, ReturnReason } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReturnItemInputDto {
  @ApiProperty()
  @IsString()
  skuId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateReturnDto {
  @ApiProperty()
  @IsString()
  orderId!: string;

  @ApiProperty({ enum: ReturnReason })
  @IsEnum(ReturnReason)
  reason!: ReturnReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerNote?: string;

  @ApiProperty({ type: [ReturnItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemInputDto)
  items!: ReturnItemInputDto[];
}

// EG: public customer portal — no auth, verified by order reference + phone.
export class PortalReturnDto {
  @ApiProperty()
  @IsString()
  orderReference!: string;

  @ApiProperty({ example: '+201001234567' })
  @Matches(/^\+?[0-9]{7,15}$/)
  customerPhone!: string;

  @ApiProperty({ enum: ReturnReason })
  @IsEnum(ReturnReason)
  reason!: ReturnReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  customerNote?: string;

  @ApiProperty({ type: [ReturnItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemInputDto)
  items!: ReturnItemInputDto[];
}

export class InspectItemDto {
  @ApiProperty({ enum: ReturnDisposition })
  @IsEnum(ReturnDisposition)
  disposition!: ReturnDisposition;

  @ApiProperty({ description: 'Location to restock (resellable) or quarantine (damaged) into' })
  @IsString()
  restockLocationId!: string;
}
