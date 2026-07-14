import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsObject, IsOptional, IsString } from 'class-validator'

export class McpToolCallDto {
  @ApiProperty()
  @IsString()
  name: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  arguments?: Record<string, unknown>
}
