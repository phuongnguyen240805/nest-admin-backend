import { IsEnum, IsOptional, IsString } from 'class-validator'

export class BillingSubscribeDto {
  @IsEnum(['pro', 'enterprise', 'lifetime'])
  @IsOptional()
  plan?: 'pro' | 'enterprise' | 'lifetime'

  @IsEnum(['pro', 'enterprise'])
  @IsOptional()
  tier?: 'pro' | 'enterprise'

  @IsEnum(['monthly', 'yearly'])
  @IsOptional()
  period?: 'monthly' | 'yearly'

  @IsEnum(['stripe', 'crypto', 'payos'])
  @IsOptional()
  paymentMethod?: 'stripe' | 'crypto' | 'payos'

  @IsString()
  @IsOptional()
  priceId?: string

  @IsString()
  @IsOptional()
  successUrl?: string

  @IsString()
  @IsOptional()
  cancelUrl?: string
}
