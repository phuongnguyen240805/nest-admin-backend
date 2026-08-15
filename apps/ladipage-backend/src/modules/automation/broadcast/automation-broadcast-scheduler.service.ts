import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { InjectBullQueue } from '@liora/nest-core'
import type { Queue } from 'bullmq'

import { AUTOMATION_QUEUES } from '../queues/constants'
import { isAutomationBroadcastEnabled, isAutomationTenantAllowed } from '../runtime/automation-feature-gate'
import { AutomationBroadcastRuntimeService } from './automation-broadcast-runtime.service'

@Injectable()
export class AutomationBroadcastSchedulerService {
  private readonly logger = new Logger(AutomationBroadcastSchedulerService.name)
  private running = false

  constructor(
    private readonly broadcasts: AutomationBroadcastRuntimeService,
    @InjectBullQueue(AUTOMATION_QUEUES.BROADCAST)
    private readonly queue: Queue,
  ) {}

  @Interval(2_000)
  async tick(): Promise<void> {
    if (!this.enabled() || this.running) return
    this.running = true
    try {
      const campaigns = await this.broadcasts.dispatchableBroadcasts(20)
      const recipientLimit = this.intEnv('AUTOMATION_BROADCAST_BATCH_SIZE', 200, 1, 1000)
      for (const campaign of campaigns) {
        if (!isAutomationTenantAllowed(campaign.tenantId)) continue
        if (campaign.status === 'SCHEDULED') {
          const activated = await this.broadcasts.activate(campaign.tenantId, campaign.externalId)
          if (!activated) continue
        }
        const recipients = await this.broadcasts.pendingRecipients(campaign.tenantId, campaign.externalId, recipientLimit)
        for (const recipient of recipients) {
          await this.queue.add(
            'recipient',
            { tenantId: recipient.tenantId, recipientId: recipient.recipientId },
            { jobId: `automation-broadcast-${recipient.recipientId}` },
          )
          await this.broadcasts.markQueued(recipient.tenantId, recipient.recipientId)
        }
      }
    } catch (error) {
      this.logger.error('Automation broadcast scheduler failed', error instanceof Error ? error.stack : error)
    } finally {
      this.running = false
    }
  }

  private enabled(): boolean {
    return isAutomationBroadcastEnabled()
  }

  private intEnv(name: string, fallback: number, min: number, max: number): number {
    const parsed = Number(process.env[name] ?? fallback)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(min, Math.min(max, Math.trunc(parsed)))
  }
}
