import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'

import { FlowExecutionEntity } from '../entities'

export interface CreateFlowExecutionInput {
  tenantId: number
  flowExternalId: string
  conversationId?: string
  contactId?: string
  triggerId?: string
  triggerEventId?: string
  context?: Record<string, unknown>
  variables?: Record<string, unknown>
}

@Injectable()
export class FlowExecutionService {
  constructor(
    @InjectRepository(FlowExecutionEntity)
    private readonly executions: Repository<FlowExecutionEntity>,
  ) {}

  async createPending(input: CreateFlowExecutionInput): Promise<FlowExecutionEntity> {
    if (input.triggerEventId && input.triggerId) {
      const existing = await this.executions.findOne({
        where: {
          tenantId: input.tenantId,
          triggerEventId: input.triggerEventId,
          triggerId: input.triggerId,
          flowExternalId: input.flowExternalId,
        },
      })
      if (existing) return existing
    }

    return this.executions.save(this.executions.create({
      tenantId: input.tenantId,
      executionId: randomUUID(),
      flowExternalId: input.flowExternalId,
      conversationId: input.conversationId ?? null,
      contactId: input.contactId ?? null,
      triggerId: input.triggerId ?? null,
      triggerEventId: input.triggerEventId ?? null,
      status: 'PENDING',
      currentNodeId: null,
      context: input.context ?? {},
      variables: input.variables ?? {},
      startedAt: null,
      waitingUntil: null,
      completedAt: null,
      failedAt: null,
      lastError: null,
      version: 1,
    }))
  }
}
