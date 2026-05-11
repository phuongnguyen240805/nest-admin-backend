import { ApiProperty, PartialType } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator'

import { PagerDto } from '@liora/dto/pager.dto'

import { DictItemEntity } from './dict-item.entity'

export class DictItemDto extends PartialType(DictItemEntity) {
  @ApiProperty({ description: '字典类型 ID' })
  @IsInt()
  typeId: number

  @ApiProperty({ description: '字典项键名' })
  @IsString()
  @MinLength(1)
  override label: string

  @ApiProperty({ description: '字典项值' })
  @IsString()
  @MinLength(1)
  override value: string

  @ApiProperty({ description: '状态' })
  @IsOptional()
  @IsInt()
  override status?: number

  @ApiProperty({ description: '备注' })
  @IsOptional()
  @IsString()
  override remark?: string
}

export class DictItemQueryDto extends PagerDto {
  @ApiProperty({ description: '字典类型 ID', required: true })
  @IsInt()
  typeId: number

  @ApiProperty({ description: '字典项键名' })
  @IsString()
  @IsOptional()
  label?: string

  @ApiProperty({ description: '字典项值' })
  @IsString()
  @IsOptional()
  value?: string
}
