import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString } from 'class-validator'

import { CloudPhonePlanPeriod } from '../enums/cloud-phone.enums'

export class CreateBookingDto {
  /** GADS device UDID to rent. */
  @ApiProperty()
  @IsString()
  deviceId: string

  @ApiProperty()
  @IsString()
  planCode: string

  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'day' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  period?: CloudPhonePlanPeriod
}
