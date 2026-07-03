import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'

export class CreateSeoProjectDto {
  @ApiProperty({ description: 'Domain or published landing page hostname' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  hostname: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  landingPageId?: string
}
