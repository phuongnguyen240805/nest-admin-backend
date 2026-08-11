import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { OrderPaymentProvider, OrderPaymentProviderCreateInput, OrderPaymentProviderCreateResult } from '../order-payment-provider'
import { buildSepayQrUrl } from './sepay-payment'

@Injectable()
export class SepayQrProvider implements OrderPaymentProvider {
  constructor(private readonly config: ConfigService) {}

  createPayment(input: OrderPaymentProviderCreateInput): OrderPaymentProviderCreateResult {
    const account = this.config.get<string>('SEPAY_BANK_ACCOUNT')?.trim() ?? ''
    const bank = this.config.get<string>('SEPAY_BANK_NAME')?.trim() ?? ''
    if (!account || !bank) {
      throw new ServiceUnavailableException('SePay bank account is not configured')
    }

    return {
      qrUrl: buildSepayQrUrl({
        account,
        bank,
        amount: input.amount,
        referenceCode: input.referenceCode,
        template: this.config.get<string>('SEPAY_QR_TEMPLATE')?.trim() || 'compact',
        holder: this.config.get<string>('SEPAY_ACCOUNT_HOLDER')?.trim(),
        store: this.config.get<string>('SEPAY_STORE_NAME')?.trim(),
      }),
      metadata: { bank, accountNumber: account },
    }
  }
}
