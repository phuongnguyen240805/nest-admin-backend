import { Injectable, Logger } from '@nestjs/common'
import { ContextIdFactory, ModuleRef } from '@nestjs/core'
import { Interval } from '@nestjs/schedule'

import { CustomerCareService } from './customer-care.service'

/**
 * Static scheduler wrapper. CustomerCareService has non-static dependencies,
 * so Nest cannot register interval decorators declared on that service.
 */
@Injectable()
export class CustomerCareOperationalWorker {
  private readonly logger = new Logger(CustomerCareOperationalWorker.name)
  private flushing = false
  private cleaning = false

  constructor(private readonly moduleRef: ModuleRef) {}

  @Interval(10_000)
  async flushOutbox() {
    if (this.flushing) return
    this.flushing = true
    try {
      const service = await this.resolveService()
      await service.flushOutbox()
    } catch (error) {
      this.logger.warn(`Customer Care outbox flush failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.flushing = false
    }
  }

  @Interval(6 * 60 * 60_000)
  async cleanupOperationalEvents() {
    if (this.cleaning) return
    this.cleaning = true
    try {
      const service = await this.resolveService()
      await service.cleanupOperationalEvents()
    } catch (error) {
      this.logger.warn(`Customer Care cleanup failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.cleaning = false
    }
  }

  private resolveService() {
    return this.moduleRef.resolve(CustomerCareService, ContextIdFactory.create(), { strict: false })
  }
}
