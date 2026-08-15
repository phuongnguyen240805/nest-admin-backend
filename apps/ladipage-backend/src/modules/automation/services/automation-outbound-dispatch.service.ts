import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'

import { AutomationOutboundDispatchEntity } from '../entities'

@Injectable()
export class AutomationOutboundDispatchService {
  constructor(
    @InjectRepository(AutomationOutboundDispatchEntity)
    private readonly dispatches: Repository<AutomationOutboundDispatchEntity>,
  ) {}

  async cancelForExecution(tenantId: number, executionId: string, reason = 'automation execution cancelled'): Promise<void> {
    await this.dispatches.createQueryBuilder()
      .update()
      .set({ status: 'CANCELLED', lastError: reason, completedAt: new Date() })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('execution_id = :executionId', { executionId })
      .andWhere("status IN ('PENDING','SENDING')")
      .execute()
  }

  async request(input: {
    tenantId: number
    executionId: string
    nodeId: string
    logicalIteration?: number
    conversationId: string
    messageType?: string
    content: string
    attachments?: number[]
  }): Promise<AutomationOutboundDispatchEntity> {
    const logicalIteration = input.logicalIteration ?? 0
    const idempotencyKey = `${input.executionId}:${input.nodeId}:${logicalIteration}`
    const existing = await this.dispatches.findOne({
      where: { tenantId: input.tenantId, idempotencyKey },
    })
    if (existing) return existing

    try {
      return await this.dispatches.save(this.dispatches.create({
        tenantId: input.tenantId,
        dispatchId: randomUUID(),
        idempotencyKey,
        executionId: input.executionId,
        nodeId: input.nodeId,
        logicalIteration,
        conversationId: input.conversationId,
        clientMessageId: randomUUID(),
        messageType: input.messageType ?? 'text',
        content: input.content,
        attachments: input.attachments ?? [],
        status: 'PENDING',
        attemptCount: 0,
        availableAt: new Date(),
        providerMessageId: null,
        lastError: null,
        completedAt: null,
      }))
    } catch (error) {
      const raced = await this.dispatches.findOne({
        where: { tenantId: input.tenantId, idempotencyKey },
      })
      if (raced) return raced
      throw error
    }
  }
}
