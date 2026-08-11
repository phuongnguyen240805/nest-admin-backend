import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { verifySepayHmac } from './sepay-payment'

@Injectable()
export class SepayWebhookAuthService {
  constructor(private readonly config: ConfigService) {}

  verify(rawBody: string, timestampHeader: string, signatureHeader: string): void {
    const secret = this.config.get<string>('SEPAY_WEBHOOK_SECRET')?.trim() ?? ''
    if (!secret) throw new UnauthorizedException('SePay webhook secret is not configured')

    if (!verifySepayHmac({ secret, rawBody, timestampHeader, signatureHeader })) {
      throw new UnauthorizedException('Invalid or expired SePay webhook signature')
    }
  }
}
