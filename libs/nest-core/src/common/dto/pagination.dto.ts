import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min, IsString, IsEnum } from 'class-validator';
import { Transform, Expose } from 'class-transformer';

/**
 * PaginationDto - Standardized pagination input.
 * Use this (or extend it) in all list endpoints across modules.
 */
export class PaginationDto {
  @ApiProperty({ description: 'Page number (1-based)', minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => (value ? parseInt(value, 10) : 1))
  @Expose()
  page: number = 1;

  @ApiProperty({ description: 'Number of items per page', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => (value ? parseInt(value, 10) : 20))
  @Expose()
  limit: number = 20;

  @ApiProperty({ description: 'Field to sort by', required: false, example: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({ description: 'Sort direction', enum: ['ASC', 'DESC'], required: false })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  @Transform(({ value }) => (value ? value.toUpperCase() : 'DESC'))
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
