import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export const MCP_API_KEY_SCOPES = [
  'workspace:read',
  'landing:read',
  'landing:create',
  'landing:update',
  'landing:publish',
  'landing:delete',
  'asset:generate',
  'asset:upload',
  'lead:read',
  'order:read',
] as const

export type McpApiKeyScope = typeof MCP_API_KEY_SCOPES[number]

export class CreateApiKeyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string

  @ApiPropertyOptional({ enum: MCP_API_KEY_SCOPES, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(MCP_API_KEY_SCOPES, { each: true })
  scopes?: McpApiKeyScope[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string
}

export class UpdateApiKeyScopesDto {
  @ApiProperty({ enum: MCP_API_KEY_SCOPES, isArray: true })
  @IsArray()
  @IsIn(MCP_API_KEY_SCOPES, { each: true })
  scopes: McpApiKeyScope[]
}

export interface ApiKeyListItemDto {
  id: number
  name: string
  keyPrefix: string
  scopes: McpApiKeyScope[]
  status: string
  isDefault: boolean
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

export interface CreatedApiKeyDto extends ApiKeyListItemDto {
  key: string
}
