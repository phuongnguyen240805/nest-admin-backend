import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class OpenEditorSessionDto {
  @ApiProperty({ description: 'Ladipage landing_pages.id' })
  @IsString()
  @IsNotEmpty()
  pageId: string
}

export class MaterializeHtmlDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pageId: string

  @ApiProperty({ description: 'Full HTML document or fragment to import into Instatic' })
  @IsString()
  @IsNotEmpty()
  html: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workspaceId?: string
}

export class PublishIntentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pageId: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalPageId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  html?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  etag?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoTitle?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoDescription?: string
}
