import { ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsBoolean, IsEnum, IsOptional } from 'class-validator'

import { CreateSeoProjectDto } from './create-seo-project.dto'

export enum UpdateSeoProjectStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export class UpdateSeoProjectDto extends PartialType(CreateSeoProjectDto) {
  @ApiPropertyOptional({ enum: UpdateSeoProjectStatus })
  @IsOptional()
  @IsEnum(UpdateSeoProjectStatus)
  status?: UpdateSeoProjectStatus

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean
}
