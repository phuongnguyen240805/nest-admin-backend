import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { Repository } from 'typeorm'

import { AutomationActionDispatchEntity } from '../entities'

export interface RequestAutomationActionInput {
  tenantId: number
  executionId: string
  nodeId: string
  logicalIteration?: number
  conversationId?: string | null
  actionType: string
  payload?: Record<string, unknown>
  resultVariable?: string | null
  idempotencyKey?: string
}

@Injectable()
export class AutomationActionDispatchService {
  constructor(
    @InjectRepository(AutomationActionDispatchEntity)
    private readonly dispatches: Repository<AutomationActionDispatchEntity>,
  ) {}

  async request(input: RequestAutomationActionInput): Promise<AutomationActionDispatchEntity> {
    const logicalIteration = input.logicalIteration ?? 0
    const idempotencyKey = String(
      input.idempotencyKey
      ?? `${input.executionId}:${input.nodeId}:${logicalIteration}:action`,
    ).slice(0, 255)

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
        conversationId: input.conversationId ?? null,
        actionType: this.normalizeActionType(input.actionType),
        payload: input.payload ?? {},
        result: {},
        resultVariable: this.optionalString(input.resultVariable) ?? null,
        status: 'PENDING',
        attemptCount: 0,
        availableAt: new Date(),
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

  async cancelForExecution(tenantId: number, executionId: string, reason = 'execution-cancelled'): Promise<void> {
    await this.dispatches.createQueryBuilder()
      .update(AutomationActionDispatchEntity)
      .set({ status: 'CANCELLED', completedAt: new Date(), lastError: reason })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('execution_id = :executionId', { executionId })
      .andWhere("status IN ('PENDING', 'RUNNING', 'FAILED')")
      .execute()
  }

  async retryDead(tenantId: number, dispatchId: string): Promise<AutomationActionDispatchEntity | null> {
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
      .update(AutomationActionDispatchEntity)
      .set({ status: 'PENDING', attemptCount: 0, availableAt: new Date(), lastError: null, completedAt: null })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('execution_id = :executionId', { executionId })
      .andWhere("status IN ('DEAD', 'FAILED')")
      .execute()
    return Number(result.affected ?? 0)
  }

  private normalizeActionType(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase()
      .slice(0, 80)
  }

  private optionalString(value: unknown): string | undefined {
    const text = String(value ?? '').trim()
    return text || undefined
  }
}
