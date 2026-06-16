import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength } from 'class-validator'

import { PagerDto } from '@liora/dto'

export class CompanyQueryDto extends PagerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string
}

export class CreateCompanyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string
}

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}