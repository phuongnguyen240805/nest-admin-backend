import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator'

import { PagerDto } from '@liora/dto'

export class DeliveryNoteQueryDto extends PagerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  orderId?: number
}

export class CreateDeliveryNoteDto {
  @ApiProperty()
  @IsInt()
  orderId: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  shippedAt?: string
}

export class UpdateDeliveryNoteDto extends PartialType(CreateDeliveryNoteDto) {}