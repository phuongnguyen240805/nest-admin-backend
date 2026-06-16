import { Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'

class FacebookIntegrationInputDto {
  @IsOptional()
  @IsString()
  token?: string

  @IsOptional()
  @IsString()
  pageId?: string
}

class ZaloIntegrationInputDto {
  @IsOptional()
  @IsString()
  token?: string

  @IsOptional()
  @IsString()
  oaId?: string
}

export class UpdateIntegrationsSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => FacebookIntegrationInputDto)
  facebook?: FacebookIntegrationInputDto

  @IsOptional()
  @ValidateNested()
  @Type(() => ZaloIntegrationInputDto)
  zalo?: ZaloIntegrationInputDto
}