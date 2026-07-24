import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'

import type { LabScanDepth, LabScanTrigger } from '../queues/constants'

export enum LabScanTriggerDto {
  EDITOR = 'editor',
  LIST = 'list',
  AI_SEO = 'ai_seo',
  PUBLISH = 'publish',
}

export enum LabScanDepthDto {
  QUICK = 'quick',
  FULL = 'full',
}

export class CreateLabScanDto {
  @ApiProperty({ enum: LabScanTriggerDto })
  @IsEnum(LabScanTriggerDto)
  trigger!: LabScanTrigger

  @ApiPropertyOptional({ enum: LabScanDepthDto })
  @IsOptional()
  @IsEnum(LabScanDepthDto)
  depth?: LabScanDepth

  @ApiPropertyOptional({ description: 'SEO project UUID (tenant-scoped)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  seoProjectId?: string

  @ApiPropertyOptional({ description: 'lp_seo_project_page.id' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  seoProjectPageId?: string

  @ApiPropertyOptional({ description: 'Builder / website page id (externalId)' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  websitePageId?: string

  @ApiPropertyOptional({
    description: 'Override scan URL (validated; local only when allowLocal)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  targetUrl?: string

  @ApiPropertyOptional({
    description: 'Allow localhost/private hosts (editor pre-publish / dev)',
  })
  @IsOptional()
  @IsBoolean()
  allowLocal?: boolean

  @ApiPropertyOptional({ description: 'Force mock runner (tests / no Chromium)' })
  @IsOptional()
  @IsBoolean()
  mock?: boolean
}
