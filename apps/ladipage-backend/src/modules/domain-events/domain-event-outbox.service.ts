import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { EntityManager, Repository } from 'typeorm'

import { DomainOutboxEventEntity } from './entities/domain-outbox-event.entity'

export interface AppendDomainEventInput {
  tenantId: number
  aggregateType: string
  aggregateId: string | number
  eventType: string
  payload?: Record<string, unknown>
  eventId?: string
  availableAt?: Date
}

@Injectable()
export class DomainEventOutboxService {
  constructor(
    @InjectRepository(DomainOutboxEventEntity)
    private readonly events: Repository<DomainOutboxEventEntity>,
  ) {}

  async append(input: AppendDomainEventInput, manager?: EntityManager) {
    const repo = manager
      ? manager.getRepository(DomainOutboxEventEntity)
      : this.events
    const row = repo.create({
      eventId: input.eventId ?? randomUUID(),
      tenantId: input.tenantId,
      aggregateType: input.aggregateType,
      aggregateId: String(input.aggregateId),
      eventType: input.eventType,
      payload: input.payload ?? {},
      status: 'pending',
      attempts: 0,
      availableAt: input.availableAt ?? new Date(),
      processedAt: null,
      lastError: null,
    })
    return repo.save(row)
  }

  async markProcessed(eventId: string) {
    await this.events.update({ eventId }, {
      status: 'processed',
      processedAt: new Date(),
      lastError: null,
    })
  }

  async markFailed(eventId: string, error: unknown) {
    const row = await this.events.findOne({ where: { eventId } })
    if (!row) return
    row.status = 'failed'
    row.attempts += 1
    row.lastError = error instanceof Error ? error.message : String(error)
    await this.events.save(row)
  }
}
