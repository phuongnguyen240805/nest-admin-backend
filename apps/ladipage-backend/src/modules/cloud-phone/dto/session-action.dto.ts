import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsObject, IsOptional } from 'class-validator'

import {
  CLOUD_PHONE_ACTION_TYPES,
  CloudPhoneActionType,
} from '../enums/cloud-phone.enums'

/**
 * A single remote-control action sent to a session. Coordinates/text/appPackage
 * live in `params`; validated loosely here and normalized per GADS in the adapter.
 */
export class SessionActionDto {
  @ApiProperty({ enum: CLOUD_PHONE_ACTION_TYPES })
  @IsIn(CLOUD_PHONE_ACTION_TYPES as readonly string[])
  type: CloudPhoneActionType

  @ApiPropertyOptional({
    description: 'Action params: x, y, x2, y2, text, appPackage',
  })
  @IsOptional()
  @IsObject()
  params?: {
    x?: number
    y?: number
    x2?: number
    y2?: number
    text?: string
    appPackage?: string
  }
}
