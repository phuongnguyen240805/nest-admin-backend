import { IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateWorkspaceSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string

  @IsOptional()
  @IsString()
  logo?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  locale?: string

  @IsOptional()
  @IsString()
  description?: string
}