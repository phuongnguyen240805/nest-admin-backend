import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator'

export enum SeoDashboardProjectStatus {
  ALL = 'all',
  SCANNING = 'scanning',
  NOT_INSTALLED = 'not_installed',
  READY = 'ready',
}

export enum SeoDashboardProjectSort {
  UPDATED_DESC = 'updated_desc',
  UPDATED_ASC = 'updated_asc',
  FAVORITES = 'favorites',
}

export class ListSeoDashboardProjectsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ default: 10, enum: [10] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([10])
  pageSize?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    enum: SeoDashboardProjectStatus,
    default: SeoDashboardProjectStatus.ALL,
  })
  @IsOptional()
  @IsEnum(SeoDashboardProjectStatus)
  status?: SeoDashboardProjectStatus

  @ApiPropertyOptional({
    enum: SeoDashboardProjectSort,
    default: SeoDashboardProjectSort.UPDATED_DESC,
  })
  @IsOptional()
  @IsEnum(SeoDashboardProjectSort)
  sort?: SeoDashboardProjectSort
}
