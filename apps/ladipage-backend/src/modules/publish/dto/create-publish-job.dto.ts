import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

export class CreatePublishJobDto {
  @IsOptional()
  draftOverride?: unknown

  @IsOptional()
  @IsBoolean()
  preserveHtml?: boolean

  @IsOptional()
  @IsUUID()
  domainId?: string

  @IsOptional()
  @IsString()
  @MaxLength(512)
  path?: string
}
