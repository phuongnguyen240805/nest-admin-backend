import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

import { PagerDto } from '@liora/dto'

export enum TaskStatusDto {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export class TaskQueryDto extends PagerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  personId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  opportunityId?: string

  @ApiPropertyOptional({ enum: TaskStatusDto })
  @IsOptional()
  @IsEnum(TaskStatusDto)
  status?: TaskStatusDto
}

export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  title: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string

  @ApiPropertyOptional({ enum: TaskStatusDto })
  @IsOptional()
  @IsEnum(TaskStatusDto)
  status?: TaskStatusDto

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  assigneeId?: number
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}