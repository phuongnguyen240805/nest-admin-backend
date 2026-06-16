import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, Min } from 'class-validator'

export class UpdateInventoryDto {
  @ApiPropertyOptional({ description: 'Set absolute stock value' })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number

  @ApiPropertyOptional({ description: 'Adjust stock by delta (+/-)' })
  @IsOptional()
  @IsInt()
  delta?: number
}