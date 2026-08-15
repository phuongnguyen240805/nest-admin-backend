import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { InjectBullQueue } from '@liora/nest-core'
import type { Queue } from 'bullmq'
import { Repository } from 'typeorm'

import { FlowExecutionEntity } from '../entities'
import { AUTOMATION_QUEUES } from '../queues/constants'
import { isAutomationRuntimeEnabled, isAutomationTenantAllowed } from './automation-feature-gate'

@Injectable()
export class AutomationFlowRecoverySchedulerService {
  private readonly logger = new Logger(AutomationFlowRecoverySchedulerService.name)
  private running = false

  constructor(
    @InjectRepository(FlowExecutionEntity)
    private readonly executions: Repository<FlowExecutionEntity>,
    @InjectBullQueue(AUTOMATION_QUEUES.FLOW)
    private readonly flowQueue: Queue,
    @InjectBullQueue(AUTOMATION_QUEUES.RESUME)
    private readonly resumeQueue: Queue,
  ) {}

  @Interval(10_000)
  async tick(): Promise<void> {
    if (!this.enabled() || this.running) return
    this.running = true
    try {
      const limit = this.intEnv('AUTOMATION_RECOVERY_BATCH_SIZE', 50, 1, 200)
      const runnable = await this.executions.createQueryBuilder('execution')
        .where("(execution.status = 'PENDING' AND execution.updated_at <= NOW() - INTERVAL '30 seconds') OR (execution.status = 'RUNNING' AND execution.locked_until <= NOW())")
        .orderBy('execution.updated_at', 'ASC')
        .take(limit)
        .getMany()
      const bucket = Math.floor(Date.now() / 10_000)
      for (const execution of runnable) {
        if (!isAutomationTenantAllowed(execution.tenantId)) continue
        await this.flowQueue.add(
          'recover',
          { tenantId: execution.tenantId, executionId: execution.executionId },
          { jobId: `automation-flow-recover-${execution.executionId}-${bucket}` },
        )
      }

      const timers = await this.executions.createQueryBuilder('execution')
        .where("execution.status = 'WAITING'")
        .andWhere('execution.waiting_until IS NOT NULL AND execution.waiting_until <= NOW()')
        .orderBy('execution.waiting_until', 'ASC')
        .take(limit)
        .getMany()
      for (const execution of timers) {
        if (!isAutomationTenantAllowed(execution.tenantId)) continue
        if (String(execution.context?.waitingReason ?? '') !== 'timer') continue
        const waitingNodeId = String(execution.context?.waitingNodeId ?? '').trim()
        if (!waitingNodeId) continue
        await this.resumeQueue.add(
          'recover-timer',
          { tenantId: execution.tenantId, executionId: execution.executionId, waitingNodeId },
          { jobId: `automation-resume-recover-${execution.executionId}-${bucket}` },
        )
      }
    } catch (error) {
      this.logger.error('Automation flow recovery scan failed', error instanceof Error ? error.stack : error)
    } finally {
      this.running = false
    }
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
