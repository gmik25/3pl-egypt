import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateSkuDto } from './create-sku.dto';

// clientId + code are immutable after creation; everything else is editable.
export class UpdateSkuDto extends PartialType(OmitType(CreateSkuDto, ['clientId', 'code'] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
