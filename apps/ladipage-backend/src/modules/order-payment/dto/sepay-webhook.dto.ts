import { Type } from 'class-transformer'
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class SepayWebhookDto {
  @Type(() => Number)
  @IsInt()
  id: number

  @IsString()
  gateway: string

  @IsString()
  transactionDate: string

  @IsString()
  accountNumber: string

  @IsOptional()
  @IsString()
  subAccount?: string

  @IsOptional()
  @IsString()
  code?: string | null

  @IsString()
  content: string

  @IsIn(['in', 'out'])
  transferType: 'in' | 'out'

  @IsOptional()
  @IsString()
  description?: string

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  transferAmount: number

  @Type(() => Number)
  @IsNumber()
  accumulated: number

  @IsOptional()
  @IsString()
  referenceCode?: string
}
