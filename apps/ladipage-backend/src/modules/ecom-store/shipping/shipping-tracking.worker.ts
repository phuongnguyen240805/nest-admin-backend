import { Injectable, Logger } from '@nestjs/common'
import { ContextIdFactory, ModuleRef } from '@nestjs/core'
import { InjectRepository } from '@nestjs/typeorm'
import { Interval } from '@nestjs/schedule'
import { ClsService } from 'nestjs-cls'
import { In, LessThan, Repository } from 'typeorm'

import { ShipmentEntity } from '../entities'
import { ShippingService } from './shipping.service'

@Injectable()
export class ShippingTrackingWorker {
  private readonly logger = new Logger(ShippingTrackingWorker.name)
  private running = false

  constructor(
    @InjectRepository(ShipmentEntity)
    private readonly shipments: Repository<ShipmentEntity>,
    private readonly moduleRef: ModuleRef,
    private readonly cls: ClsService,
  ) {}

  @Interval(5 * 60_000)
  async reconcileTracking() {
    if (this.running) return
    this.running = true
    try {
      const stale = await this.shipments.find({
        where: {
          status: In(['CREATED', 'PICKING', 'PICKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY']),
          lastTrackedAt: LessThan(new Date(Date.now() - 10 * 60_000)),
        },
        order: { lastTrackedAt: 'ASC' },
        take: 50,
      })
      const pending = await this.shipments.find({
        where: {
          status: In(['PENDING_PROVIDER', 'FAILED_RETRYABLE']),
          updatedAt: LessThan(new Date(Date.now() - 2 * 60_000)),
        },
        order: { updatedAt: 'ASC' },
        take: 20,
      })
      for (const shipment of pending) {
        await this.runForTenant(shipment, (service) => service.retryPending(shipment.orderId))
      }
      for (const shipment of stale) {
        await this.runForTenant(shipment, (service) => service.refresh(shipment.orderId))
      }
    } finally {
      this.running = false
    }
  }

  private runForTenant(
    shipment: ShipmentEntity,
    operation: (service: ShippingService) => Promise<unknown>,
  ) {
    return this.cls.run(async () => {
      this.cls.set('tenantId', shipment.tenantId)
      try {
        const service = await this.moduleRef.resolve(
          ShippingService,
          ContextIdFactory.create(),
          { strict: false },
        )
        await operation(service)
      } catch (error) {
        this.logger.warn(
          `Shipping reconciliation failed for shipment ${shipment.id}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    })
  }
}
