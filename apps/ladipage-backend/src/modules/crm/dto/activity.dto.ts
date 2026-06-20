import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsUUID } from 'class-validator'

import { PagerDto } from '@liora/dto'

export class ActivityQueryDto extends PagerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  personId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  opportunityId?: string
}