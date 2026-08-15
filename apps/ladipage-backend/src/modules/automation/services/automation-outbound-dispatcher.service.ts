import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { InjectBullQueue } from '@liora/nest-core'
import type { Queue } from 'bullmq'
import { DataSource, Repository } from 'typeorm'

import { CustomerCareService } from '../../customer-care/customer-care.service'
import type { SendMessageDto } from '../../customer-care/customer-care.dto'
import { AutomationOutboundDispatchEntity } from '../entities'
import { AUTOMATION_QUEUES } from '../queues/constants'
import { FlowExecutionService } from '../runtime/flow-execution.service'
import { isAutomationRuntimeEnabled, isAutomationTenantAllowed } from '../runtime/automation-feature-gate'
import { FlowRuntimeService } from '../runtime/flow-runtime.service'

@Injectable()
export class AutomationOutboundDispatcherService {
  private readonly logger = new Logger(AutomationOutboundDispatcherService.name)
  private running = false

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AutomationOutboundDispatchEntity)
    private readonly dispatches: Repository<AutomationOutboundDispatchEntity>,
    private readonly customerCare: CustomerCareService,
    private readonly executions: FlowExecutionService,
    private readonly runtime: FlowRuntimeService,
    @InjectBullQueue(AUTOMATION_QUEUES.FLOW)
    private readonly flowQueue: Queue,
  ) {}

  @Interval(1_000)
  async tick(): Promise<void> {
    if (!this.enabled() || this.running) return
    this.running = true
    try {
      const limit = this.intEnv('AUTOMATION_OUTBOUND_BATCH_SIZE', 20, 1, 100)
      for (let index = 0; index < limit; index += 1) {
        const dispatch = await this.claimOne()
        if (!dispatch) break
        await this.deliver(dispatch)
      }
    } catch (error) {
      this.logger.error('Automation outbound dispatcher failed', error instanceof Error ? error.stack : error)
    } finally {
      this.running = false
    }
  }

  private async claimOne(): Promise<AutomationOutboundDispatchEntity | null> {
    const leaseMs = this.intEnv('AUTOMATION_OUTBOUND_LEASE_MS', 60_000, 10_000, 10 * 60_000)
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(AutomationOutboundDispatchEntity)
      const row = await repo.createQueryBuilder('dispatch')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where("dispatch.status = 'PENDING' OR (dispatch.status = 'SENDING' AND dispatch.available_at <= NOW())")
        .andWhere('dispatch.available_at <= NOW()')
        .orderBy('dispatch.available_at', 'ASC')
        .getOne()
      if (!row) return null
      row.status = 'SENDING'
      row.attemptCount += 1
      row.availableAt = new Date(Date.now() + leaseMs)
      row.lastError = null
      return repo.save(row)
    })
  }

  private async deliver(dispatch: AutomationOutboundDispatchEntity): Promise<void> {
    if (!isAutomationRuntimeEnabled() || !isAutomationTenantAllowed(dispatch.tenantId)) {
      dispatch.status = 'PENDING'
      dispatch.availableAt = new Date(Date.now() + 60_000)
      await this.dispatches.save(dispatch)
      return
    }
    try {
      const execution = await this.executions.find(dispatch.tenantId, dispatch.executionId)
      if (!execution || ['CANCELLED', 'FAILED', 'COMPLETED'].includes(execution.status)) {
        dispatch.status = 'CANCELLED'
        dispatch.completedAt = new Date()
        dispatch.lastError = execution ? `execution-${execution.status.toLowerCase()}` : 'execution-not-found'
        await this.dispatches.save(dispatch)
        return
      }
      const type = this.messageType(dispatch.messageType)
      const dto: SendMessageDto = {
        clientMessageId: dispatch.clientMessageId,
        type,
        content: dispatch.content ?? '',
        attachments: dispatch.attachments ?? [],
      }
      const sent = await this.customerCare.sendMessage(
        dispatch.conversationId,
        dto,
        0,
        true,
        dispatch.tenantId,
      ) as Record<string, unknown>

      dispatch.status = 'SENT'
      dispatch.completedAt = new Date()
      dispatch.providerMessageId = this.firstString(sent?.id, sent?.uuid, sent?.messageId)
      dispatch.lastError = null
      await this.dispatches.save(dispatch)

      await this.executions.completeStepByNode({
        tenantId: dispatch.tenantId,
        executionId: dispatch.executionId,
        nodeId: dispatch.nodeId,
        logicalIteration: dispatch.logicalIteration,
        outputPatch: { dispatchId: dispatch.dispatchId, providerMessageId: dispatch.providerMessageId, sent: true },
      })
      await this.executions.resume({
        tenantId: dispatch.tenantId,
        executionId: dispatch.executionId,
        contextPatch: { waitingNodeId: null, waitingReason: null, outboundDispatchId: dispatch.dispatchId },
      })
      await this.flowQueue.add(
        'run',
        { tenantId: dispatch.tenantId, executionId: dispatch.executionId },
        { jobId: `automation-flow-${dispatch.executionId}-dispatch-${dispatch.dispatchId}` },
      )
    } catch (error) {
      const maxAttempts = this.intEnv('AUTOMATION_OUTBOUND_MAX_ATTEMPTS', 5, 1, 20)
      const message = error instanceof Error ? error.message : String(error)
      dispatch.lastError = message
      if (dispatch.attemptCount >= maxAttempts) {
        dispatch.status = 'DEAD'
        dispatch.completedAt = new Date()
        await this.dispatches.save(dispatch)
        await this.runtime.failWithHooks(dispatch.tenantId, dispatch.executionId, error).catch(() => undefined)
        return
      }
      dispatch.status = 'PENDING'
      const backoffMs = Math.min(5 * 60_000, 2_000 * 2 ** Math.max(0, dispatch.attemptCount - 1))
      dispatch.availableAt = new Date(Date.now() + backoffMs)
      await this.dispatches.save(dispatch)
    }
  }

  private messageType(value: string): SendMessageDto['type'] {
    const type = String(value ?? '').toLowerCase()
    return type === 'image' || type === 'file' || type === 'sticker' ? type : 'text'
  }

  private firstString(...values: unknown[]): string | null {
    for (const value of values) {
      const text = String(value ?? '').trim()
      if (text) return text
    }
    return null
  }

  private enabled(): boolean {
    return isAutomationRuntimeEnabled()
  }

  private intEnv(name: string, fallback: number, min: number, max: number): number {
    const parsed = Number(process.env[name] ?? fallback)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(min, Math.min(max, Math.trunc(parsed)))
  }
}
