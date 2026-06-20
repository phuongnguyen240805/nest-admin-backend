import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'

import { PagerDto } from '@liora/dto'

export class NoteQueryDto extends PagerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  personId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  opportunityId?: string
}

export class CreateNoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string

  @ApiProperty()
  @IsString()
  body: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  personId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  opportunityId?: string
}

export class UpdateNoteDto extends PartialType(CreateNoteDto) {}