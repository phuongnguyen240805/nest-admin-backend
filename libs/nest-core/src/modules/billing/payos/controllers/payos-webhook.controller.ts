import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
} from '@nestjs/common'

import { Public } from '~/modules/auth/decorators/public.decorator'

import { PAYOS_CONFIG_TOKEN } from '../payos.constants'
import type { PayOsConfig } from '../interfaces/payos-config.interface'
import type { PayOsWebhookPayload } from '../dto/payos-webhook-payload.dto'
import { verifyPayOsSignature } from '../payos-signature.util'
import { PayOsWebhookExplorerService } from '../services/payos-webhook-explorer.service'

@Controller('webhooks/payos')
export class PayOsWebhookController {
  private readonly logger = new Logger(PayOsWebhookController.name)

  constructor(
    private readonly webhookExplorerService: PayOsWebhookExplorerService,
    @Inject(PAYOS_CONFIG_TOKEN) private readonly payOsConfig: PayOsConfig,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: PayOsWebhookPayload) {
    try {
      if (!payload?.data || !payload?.signature) {
        this.logger.warn('Invalid PayOS webhook payload')
        return { success: false, message: 'Invalid payload' }
      }

      if (!this.payOsConfig?.checksumKey) {
        this.logger.error('PayOS checksum key is not configured')
        return { success: false, message: 'Webhook secret not configured' }
      }

      const valid = verifyPayOsSignature(
        payload.data,
        payload.signature,
        this.payOsConfig.checksumKey,
      )

      if (!valid) {
        this.logger.warn('PayOS webhook signature verification failed')
        return { success: false, message: 'Invalid signature' }
      }

      const eventType = payload.success && payload.code === '00'
        ? 'payment.success'
        : 'payment.failed'

      this.logger.log(`Received PayOS webhook: ${eventType} order ${payload.data.orderCode}`)

      const processed = await this.webhookExplorerService.processWebhookEvent({
        type: eventType,
        payload,
      })

      return { success: true, processed, eventType }
    } catch (error: any) {
      this.logger.error(`Error processing PayOS webhook: ${error.message}`, error.stack)
      return { success: false, message: 'Error processing webhook' }
    }
  }
}