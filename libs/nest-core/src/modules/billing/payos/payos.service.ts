import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common'
import axios from 'axios'

import { PAYOS_CONFIG_TOKEN } from './payos.constants'
import type { PayOsConfig } from './interfaces/payos-config.interface'
import type {
  CreatePayOsPaymentLinkInput,
  PayOsApiResponse,
  PayOsPaymentLinkData,
} from './dto/create-payment-link.dto'
import { signPaymentLinkRequest } from './payos-signature.util'

@Injectable()
export class PayOsService {
  private readonly logger = new Logger(PayOsService.name)

  constructor(
    @Inject(PAYOS_CONFIG_TOKEN)
    private readonly config: PayOsConfig,
  ) {}

  private get apiUrl(): string {
    return this.config.apiUrl || 'https://api-merchant.payos.vn'
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'x-client-id': this.config.clientId,
      'x-api-key': this.config.apiKey,
    }
  }

  async createPaymentLink(
    input: CreatePayOsPaymentLinkInput,
  ): Promise<PayOsPaymentLinkData> {
    if (!this.config.clientId || !this.config.apiKey || !this.config.checksumKey) {
      throw new BadRequestException('PayOS is not configured')
    }

    const signature = signPaymentLinkRequest(
      {
        amount: input.amount,
        cancelUrl: input.cancelUrl,
        description: input.description,
        orderCode: input.orderCode,
        returnUrl: input.returnUrl,
      },
      this.config.checksumKey,
    )

    const body: Record<string, unknown> = {
      orderCode: input.orderCode,
      amount: input.amount,
      description: input.description,
      cancelUrl: input.cancelUrl,
      returnUrl: input.returnUrl,
      signature,
    }

    if (input.expiredAt)
      body.expiredAt = input.expiredAt

    try {
      const { data } = await axios.post<PayOsApiResponse<PayOsPaymentLinkData>>(
        `${this.apiUrl}/v2/payment-requests`,
        body,
        { headers: this.headers },
      )

      if (data.code !== '00' || !data.data) {
        this.logger.warn(`PayOS create link failed: ${data.code} ${data.desc}`)
        throw new BadRequestException(data.desc || 'Failed to create PayOS payment link')
      }

      return data.data
    } catch (error: any) {
      if (error instanceof BadRequestException)
        throw error

      const message = error?.response?.data?.desc || error?.message || 'PayOS API error'
      this.logger.error(`PayOS createPaymentLink error: ${message}`)
      throw new BadRequestException(message)
    }
  }

  async getLinkInfo(id: number | string): Promise<PayOsPaymentLinkData> {
    const { data } = await axios.get<PayOsApiResponse<PayOsPaymentLinkData>>(
      `${this.apiUrl}/v2/payment-requests/${id}`,
      { headers: this.headers },
    )

    if (data.code !== '00' || !data.data)
      throw new BadRequestException(data.desc || 'Failed to get PayOS link info')

    return data.data
  }

  async cancelLink(id: number | string, reason?: string): Promise<PayOsPaymentLinkData> {
    const { data } = await axios.post<PayOsApiResponse<PayOsPaymentLinkData>>(
      `${this.apiUrl}/v2/payment-requests/${id}/cancel`,
      { cancellationReason: reason || 'Cancelled by merchant' },
      { headers: this.headers },
    )

    if (data.code !== '00' || !data.data)
      throw new BadRequestException(data.desc || 'Failed to cancel PayOS link')

    return data.data
  }
}