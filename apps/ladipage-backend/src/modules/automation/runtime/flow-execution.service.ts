import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomUUID } from 'node:crypto'
import { DataSource, Repository } from 'typeorm'

import {
  FlowExecutionEntity,
  FlowExecutionStepEntity,
  type FlowExecutionStatus,
} from '../entities'

export interface CreateFlowExecutionInput {
  tenantId: number
  flowExternalId: string
  conversationId?: string | null
  contactId?: string | null
  triggerId?: string | null
  triggerEventId?: string | null
  context?: Record<string, unknown>
  variables?: Record<string, unknown>
}

@Injectable()
export class FlowExecutionService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(FlowExecutionEntity)
    private readonly executions: Repository<FlowExecutionEntity>,
    @InjectRepository(FlowExecutionStepEntity)
    private readonly steps: Repository<FlowExecutionStepEntity>,
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

    const row = this.executions.create({
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
      lockToken: null,
      lockedUntil: null,
      version: 1,
    })

    try {
      return await this.executions.save(row)
    } catch (error) {
      if (input.triggerEventId && input.triggerId) {
        const raced = await this.executions.findOne({
          where: {
            tenantId: input.tenantId,
            triggerEventId: input.triggerEventId,
            triggerId: input.triggerId,
            flowExternalId: input.flowExternalId,
          },
        })
        if (raced) return raced
      }
      throw error
    }
  }

  async find(tenantId: number, executionId: string): Promise<FlowExecutionEntity | null> {
    return this.executions.findOne({ where: { tenantId, executionId } })
  }

  async require(tenantId: number, executionId: string): Promise<FlowExecutionEntity> {
    const row = await this.find(tenantId, executionId)
    if (!row) throw new NotFoundException('Automation flow execution not found')
    return row
  }

  async claim(tenantId: number, executionId: string): Promise<FlowExecutionEntity | null> {
    const leaseMs = this.intEnv('AUTOMATION_FLOW_EXECUTION_LEASE_MS', 5 * 60_000, 30_000, 30 * 60_000)
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(FlowExecutionEntity)
      const row = await repo.createQueryBuilder('execution')
        .setLock('pessimistic_write')
        .where('execution.tenantId = :tenantId', { tenantId })
        .andWhere('execution.execution_id = :executionId', { executionId })
        .getOne()
      if (!row) return null
      if (['COMPLETED', 'FAILED', 'CANCELLED', 'WAITING', 'WAITING_REPLY'].includes(row.status)) return null
      if (row.status === 'RUNNING' && row.lockedUntil && row.lockedUntil.getTime() > Date.now()) return null

      row.status = 'RUNNING'
      row.startedAt ||= new Date()
      row.lockToken = randomUUID()
      row.lockedUntil = new Date(Date.now() + leaseMs)
      row.lastError = null
      return repo.save(row)
    })
  }

  async updateProgress(input: {
    tenantId: number
    executionId: string
    currentNodeId: string | null
    variables?: Record<string, unknown>
    context?: Record<string, unknown>
  }): Promise<void> {
    const row = await this.require(input.tenantId, input.executionId)
    row.currentNodeId = input.currentNodeId
    if (input.variables) row.variables = input.variables
    if (input.context) row.context = input.context
    row.version += 1
    await this.executions.save(row)
  }

  async markWaiting(input: {
    tenantId: number
    executionId: string
    currentNodeId: string | null
    waitingUntil?: Date | null
    contextPatch?: Record<string, unknown>
  }): Promise<void> {
    const row = await this.require(input.tenantId, input.executionId)
    row.status = 'WAITING'
    row.currentNodeId = input.currentNodeId
    row.waitingUntil = input.waitingUntil ?? null
    row.lockToken = null
    row.lockedUntil = null
    row.context = { ...(row.context ?? {}), ...(input.contextPatch ?? {}) }
    row.version += 1
    await this.executions.save(row)
  }

  async markWaitingReply(input: {
    tenantId: number
    executionId: string
    currentNodeId: string | null
    contextPatch?: Record<string, unknown>
  }): Promise<void> {
    const row = await this.require(input.tenantId, input.executionId)
    row.status = 'WAITING_REPLY'
    row.currentNodeId = input.currentNodeId
    row.waitingUntil = null
    row.lockToken = null
    row.lockedUntil = null
    row.context = { ...(row.context ?? {}), ...(input.contextPatch ?? {}) }
    row.version += 1
    await this.executions.save(row)
  }

  async resume(input: {
    tenantId: number
    executionId: string
    contextPatch?: Record<string, unknown>
    variablePatch?: Record<string, unknown>
  }): Promise<FlowExecutionEntity> {
    const row = await this.require(input.tenantId, input.executionId)
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(row.status)) return row
    row.status = 'PENDING'
    row.waitingUntil = null
    row.lockToken = null
    row.lockedUntil = null
    row.context = { ...(row.context ?? {}), ...(input.contextPatch ?? {}) }
    row.variables = { ...(row.variables ?? {}), ...(input.variablePatch ?? {}) }
    row.version += 1
    return this.executions.save(row)
  }

  async complete(tenantId: number, executionId: string): Promise<FlowExecutionEntity> {
    const row = await this.require(tenantId, executionId)
    if (row.status === 'COMPLETED') return row
    row.status = 'COMPLETED'
    row.currentNodeId = null
    row.completedAt = new Date()
    row.waitingUntil = null
    row.lockToken = null
    row.lockedUntil = null
    row.lastError = null
    row.version += 1
    return this.executions.save(row)
  }

  async releaseForRetry(tenantId: number, executionId: string, error: unknown): Promise<FlowExecutionEntity> {
    const row = await this.require(tenantId, executionId)
    if (['COMPLETED', 'CANCELLED'].includes(row.status)) return row
    row.status = 'PENDING'
    row.waitingUntil = null
    row.lockToken = null
    row.lockedUntil = null
    row.lastError = error instanceof Error ? error.message : String(error)
    row.version += 1
    return this.executions.save(row)
  }

  async fail(tenantId: number, executionId: string, error: unknown): Promise<FlowExecutionEntity> {
    const row = await this.require(tenantId, executionId)
    if (['COMPLETED', 'CANCELLED'].includes(row.status)) return row
    row.status = 'FAILED'
    row.failedAt = new Date()
    row.waitingUntil = null
    row.lockToken = null
    row.lockedUntil = null
    row.lastError = error instanceof Error ? error.message : String(error)
    row.version += 1
    return this.executions.save(row)
  }

  async retryFailed(tenantId: number, executionId: string): Promise<FlowExecutionEntity | null> {
    const row = await this.find(tenantId, executionId)
    if (!row || row.status !== 'FAILED') return null
    row.status = 'PENDING'
    row.failedAt = null
    row.completedAt = null
    row.waitingUntil = null
    row.lockToken = null
    row.lockedUntil = null
    row.lastError = null
    row.version += 1
    return this.executions.save(row)
  }

  async cancel(tenantId: number, executionId: string, reason = 'cancelled'): Promise<FlowExecutionEntity> {
    const row = await this.require(tenantId, executionId)
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(row.status)) return row
    row.status = 'CANCELLED'
    row.waitingUntil = null
    row.lockToken = null
    row.lockedUntil = null
    row.lastError = reason
    row.completedAt = new Date()
    row.version += 1
    return this.executions.save(row)
  }

  async createOrGetStep(input: {
    tenantId: number
    executionId: string
    nodeId: string
    nodeType: string
    logicalIteration?: number
    input?: Record<string, unknown>
  }): Promise<FlowExecutionStepEntity> {
    const logicalIteration = input.logicalIteration ?? 0
    const existing = await this.steps.findOne({
      where: {
        tenantId: input.tenantId,
        executionId: input.executionId,
        nodeId: input.nodeId,
        logicalIteration,
      },
    })
    if (existing) return existing

    try {
      return await this.steps.save(this.steps.create({
        tenantId: input.tenantId,
        executionId: input.executionId,
        nodeId: input.nodeId,
        nodeType: input.nodeType,
        logicalIteration,
        status: 'PENDING',
        attempt: 0,
        input: input.input ?? {},
        output: {},
        error: null,
        startedAt: null,
        finishedAt: null,
      }))
    } catch (error) {
      const raced = await this.steps.findOne({
        where: {
          tenantId: input.tenantId,
          executionId: input.executionId,
          nodeId: input.nodeId,
          logicalIteration,
        },
      })
      if (raced) return raced
      throw error
    }
  }

  async startStep(step: FlowExecutionStepEntity): Promise<FlowExecutionStepEntity> {
    if (step.status === 'COMPLETED') return step
    step.status = 'RUNNING'
    step.attempt += 1
    step.startedAt ||= new Date()
    step.error = null
    return this.steps.save(step)
  }

  async waitStep(step: FlowExecutionStepEntity, output: Record<string, unknown>): Promise<void> {
    step.status = 'WAITING'
    step.output = output
    step.error = null
    await this.steps.save(step)
  }

  async completeStep(step: FlowExecutionStepEntity, output: Record<string, unknown> = {}): Promise<void> {
    step.status = 'COMPLETED'
    step.output = output
    step.error = null
    step.finishedAt = new Date()
    await this.steps.save(step)
  }

  async completeStepByNode(input: {
    tenantId: number
    executionId: string
    nodeId: string
    logicalIteration?: number
    outputPatch?: Record<string, unknown>
  }): Promise<void> {
    const step = await this.steps.findOne({
      where: {
        tenantId: input.tenantId,
        executionId: input.executionId,
        nodeId: input.nodeId,
        logicalIteration: input.logicalIteration ?? 0,
      },
    })
    if (!step || step.status === 'COMPLETED') return
    await this.completeStep(step, { ...(step.output ?? {}), ...(input.outputPatch ?? {}) })
  }

  async failStep(step: FlowExecutionStepEntity, error: unknown): Promise<void> {
    if (step.status === 'COMPLETED') return
    step.status = 'FAILED'
    step.error = error instanceof Error ? error.message : String(error)
    step.finishedAt = new Date()
    await this.steps.save(step)
  }

  async findWaitingReplies(tenantId: number, conversationId: string): Promise<FlowExecutionEntity[]> {
    return this.executions.find({
      where: { tenantId, conversationId, status: 'WAITING_REPLY' as FlowExecutionStatus },
      order: { updatedAt: 'ASC' },
      take: this.intEnv('AUTOMATION_WAITING_REPLY_MAX_RESUME', 5, 1, 50),
    })
  }

  private intEnv(name: string, fallback: number, min: number, max: number): number {
    const parsed = Number(process.env[name] ?? fallback)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(min, Math.min(max, Math.trunc(parsed)))
  }
}
