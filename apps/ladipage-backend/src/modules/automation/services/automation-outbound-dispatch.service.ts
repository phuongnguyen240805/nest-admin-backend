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

  async retryDead(tenantId: number, dispatchId: string): Promise<AutomationOutboundDispatchEntity | null> {
    const row = await this.dispatches.findOne({ where: { tenantId, dispatchId } })
    if (!row || !['DEAD', 'FAILED'].includes(row.status)) return null
    row.status = 'PENDING'
    row.attemptCount = 0
    row.availableAt = new Date()
    row.lastError = null
    row.completedAt = null
    return this.dispatches.save(row)
  }

  async retryDeadForExecution(tenantId: number, executionId: string): Promise<number> {
    const result = await this.dispatches.createQueryBuilder()
      .update(AutomationOutboundDispatchEntity)
      .set({ status: 'PENDING', attemptCount: 0, availableAt: new Date(), lastError: null, completedAt: null })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('execution_id = :executionId', { executionId })
      .andWhere("status IN ('DEAD','FAILED')")
      .execute()
    return Number(result.affected ?? 0)
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
