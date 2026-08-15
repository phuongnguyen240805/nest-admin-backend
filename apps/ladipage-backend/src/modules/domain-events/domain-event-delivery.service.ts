import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { DomainEventDeliveryEntity } from './entities/domain-event-delivery.entity'

@Injectable()
export class DomainEventDeliveryService {
  constructor(
    @InjectRepository(DomainEventDeliveryEntity)
    private readonly deliveries: Repository<DomainEventDeliveryEntity>,
  ) {}

  async observe(input: {
    eventId: string
    tenantId: number
    consumer: string
    status?: string
    metadata?: Record<string, unknown>
  }): Promise<DomainEventDeliveryEntity> {
    const existing = await this.deliveries.findOne({
      where: { eventId: input.eventId, consumer: input.consumer },
    })
    if (existing) return existing

    try {
      return await this.deliveries.save(this.deliveries.create({
        eventId: input.eventId,
        tenantId: input.tenantId,
        consumer: input.consumer,
        status: input.status ?? 'observed',
        metadata: input.metadata ?? {},
        observedAt: new Date(),
        processedAt: null,
        lastError: null,
      }))
    } catch (error) {
      const raced = await this.deliveries.findOne({
        where: { eventId: input.eventId, consumer: input.consumer },
      })
      if (raced) return raced
      throw error
    }
  }

  async mark(input: {
    eventId: string
    tenantId: number
    consumer: string
    status: string
    metadata?: Record<string, unknown>
    lastError?: string | null
    processed?: boolean
  }): Promise<DomainEventDeliveryEntity> {
    let row = await this.observe({
      eventId: input.eventId,
      tenantId: input.tenantId,
      consumer: input.consumer,
      status: input.status,
      metadata: input.metadata,
    })
    row.status = input.status
    row.metadata = { ...(row.metadata ?? {}), ...(input.metadata ?? {}) }
    row.lastError = input.lastError ?? null
    if (input.processed === true) row.processedAt = new Date()
    row = await this.deliveries.save(row)
    return row
  }
}
