import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DiscoveryService } from '@nestjs/core'
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper'
import { MetadataScanner } from '@nestjs/core/metadata-scanner'

import { PAYOS_WEBHOOK_HANDLER } from '../payos.constants'
import type { PayOsWebhookHandlerMetadata } from '../decorators/payos-webhook-handler.decorator'
import type { PayOsWebhookPayload } from '../dto/payos-webhook-payload.dto'

export interface PayOsWebhookEvent {
  type: string
  payload: PayOsWebhookPayload
}

interface WebhookHandlerInfo {
  instance: any
  methodName: string
  eventName: string
}

@Injectable()
export class PayOsWebhookExplorerService implements OnModuleInit {
  private readonly logger = new Logger(PayOsWebhookExplorerService.name)
  private webhookHandlers: Map<string, WebhookHandlerInfo[]> = new Map()

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  onModuleInit() {
    this.explore()
  }

  private explore() {
    const providers = this.discoveryService.getProviders()

    providers.forEach((wrapper: InstanceWrapper) => {
      const { instance } = wrapper
      if (!instance || typeof instance !== 'object')
        return

      const prototype = Object.getPrototypeOf(instance)
      if (!prototype)
        return

      const methodNames = this.metadataScanner.getAllMethodNames(prototype)
      methodNames.forEach((methodName) => {
        this.lookupWebhookHandlers(instance, methodName)
      })
    })

    this.webhookHandlers.forEach((handlers, eventName) => {
      this.logger.log(`Discovered ${handlers.length} PayOS handler(s) for event: ${eventName}`)
    })
  }

  private lookupWebhookHandlers(instance: any, methodName: string) {
    const methodRef = instance[methodName]
    const metadata = Reflect.getMetadata(
      PAYOS_WEBHOOK_HANDLER,
      methodRef,
    ) as PayOsWebhookHandlerMetadata

    if (metadata) {
      const { eventName } = metadata
      if (!this.webhookHandlers.has(eventName))
        this.webhookHandlers.set(eventName, [])

      this.webhookHandlers.get(eventName)!.push({
        instance,
        methodName,
        eventName,
      })
    }
  }

  async processWebhookEvent(event: PayOsWebhookEvent): Promise<boolean> {
    const handlers = this.webhookHandlers.get(event.type) || []

    if (handlers.length === 0) {
      this.logger.warn(`No PayOS handlers registered for event: ${event.type}`)
      return false
    }

    await Promise.all(
      handlers.map(async (handler) => {
        const { instance, methodName } = handler
        this.logger.debug(
          `Executing PayOS handler: ${instance.constructor.name}.${methodName}`,
        )
        await instance[methodName](event.payload)
      }),
    )

    return true
  }
}