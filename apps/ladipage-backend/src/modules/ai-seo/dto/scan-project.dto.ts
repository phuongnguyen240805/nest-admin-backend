import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional } from 'class-validator'

export enum ScanDepth {
  QUICK = 'quick',
  FULL = 'full',
}

export class ScanProjectDto {
  @ApiPropertyOptional({ enum: ScanDepth })
  @IsOptional()
  @IsEnum(ScanDepth)
  depth?: ScanDepth
}
