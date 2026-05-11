import { IsEnum, IsOptional, IsString } from 'class-validator'

export class BillingSubscribeDto {
  @IsEnum(['pro', 'enterprise', 'lifetime'])
  plan: 'pro' | 'enterprise' | 'lifetime'

  @IsEnum(['stripe', 'crypto'])
  @IsOptional()
  paymentMethod?: 'stripe' | 'crypto'

  @IsString()
  @IsOptional()
  successUrl?: string

  @IsString()
  @IsOptional()
  cancelUrl?: string
}
