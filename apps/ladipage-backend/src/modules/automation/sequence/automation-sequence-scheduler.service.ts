import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { InjectBullQueue } from '@liora/nest-core'
import type { Queue } from 'bullmq'

import { AUTOMATION_QUEUES } from '../queues/constants'
import { isAutomationSequenceEnabled, isAutomationTenantAllowed } from '../runtime/automation-feature-gate'
import { AutomationSequenceService } from './automation-sequence.service'

@Injectable()
export class AutomationSequenceSchedulerService {
  private readonly logger = new Logger(AutomationSequenceSchedulerService.name)
  private running = false

  constructor(
    private readonly sequences: AutomationSequenceService,
    @InjectBullQueue(AUTOMATION_QUEUES.SEQUENCE)
    private readonly queue: Queue,
  ) {}

  @Interval(2_000)
  async tick(): Promise<void> {
    if (!this.enabled() || this.running) return
    this.running = true
    try {
      const due = await this.sequences.dueDispatches(this.intEnv('AUTOMATION_SEQUENCE_BATCH_SIZE', 50, 1, 200))
      for (const dispatch of due) {
        if (!isAutomationTenantAllowed(dispatch.tenantId)) continue
        await this.queue.add(
          'dispatch',
          { tenantId: dispatch.tenantId, dispatchId: dispatch.dispatchId },
          { jobId: `automation-sequence-${dispatch.dispatchId}` },
        )
        await this.sequences.markQueued(dispatch.tenantId, dispatch.dispatchId)
      }
    } catch (error) {
      this.logger.error('Automation sequence scheduler failed', error instanceof Error ? error.stack : error)
    } finally {
      this.running = false
    }
  }

  private enabled(): boolean {
    return isAutomationSequenceEnabled()
  }

  private intEnv(name: string, fallback: number, min: number, max: number): number {
    const parsed = Number(process.env[name] ?? fallback)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(min, Math.min(max, Math.trunc(parsed)))
  }
}
