import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator'
import { Type } from 'class-transformer'

import { CloudPhoneDeviceStatus } from '../enums/cloud-phone.enums'

export class ListDevicesQueryDto {
  @ApiPropertyOptional({ enum: ['ios', 'android'] })
  @IsOptional()
  @IsIn(['ios', 'android'])
  os?: 'ios' | 'android'

  @ApiPropertyOptional({ enum: ['ONLINE', 'BUSY', 'OFFLINE'] })
  @IsOptional()
  @IsIn(['ONLINE', 'BUSY', 'OFFLINE'])
  status?: CloudPhoneDeviceStatus

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plan?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number
}
