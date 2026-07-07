import { SetMetadata } from '@nestjs/common'

import { PAYOS_WEBHOOK_HANDLER } from '../payos.constants'

export interface PayOsWebhookHandlerMetadata {
  eventName: string
}

export const PayOsWebhookHandler = (eventName: string) =>
  SetMetadata<string, PayOsWebhookHandlerMetadata>(PAYOS_WEBHOOK_HANDLER, { eventName })