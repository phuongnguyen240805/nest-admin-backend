import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class LandingAiJobResponseDto {
  @ApiProperty()
  jobId: string

  @ApiProperty()
  pageId: string

  @ApiProperty()
  status: string

  @ApiPropertyOptional()
  progress?: number

  @ApiPropertyOptional()
  error?: string

  @ApiPropertyOptional()
  result?: Record<string, unknown>
}

export class LandingAiJobEventDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  message: string

  @ApiPropertyOptional()
  progress?: number | null

  @ApiProperty()
  createdAt: string
}