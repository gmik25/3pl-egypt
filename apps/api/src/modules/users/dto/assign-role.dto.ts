import { ApiProperty } from '@nestjs/swagger';
import { UserRoleName } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({ enum: UserRoleName })
  @IsEnum(UserRoleName)
  role!: UserRoleName;
}
