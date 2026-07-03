import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'

export class LinkLandingPageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  pageUrl: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  websitePageId?: string

  @ApiPropertyOptional({ enum: ['internal', 'external'] })
  @IsOptional()
  @IsIn(['internal', 'external'])
  source?: 'internal' | 'external'
}