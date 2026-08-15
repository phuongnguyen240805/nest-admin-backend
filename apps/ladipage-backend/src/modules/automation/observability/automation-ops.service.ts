import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { DataSource } from 'typeorm'

import type { LadiflowRpcContext } from '../../ladiflow-rpc/ladiflow-dispatcher.service'
import { AutomationActionDispatchService } from '../actions/automation-action-dispatch.service'
import { isAutomationActionsEnabled, isAutomationBroadcastEnabled, isAutomationEnabled, isAutomationHttpEnabled, isAutomationRichMessageEnabled, isAutomationRuntimeEnabled, isAutomationSequenceEnabled, isAutomationTriggerEnabled } from '../runtime/automation-feature-gate'
import { FlowExecutionService } from '../runtime/flow-execution.service'
import { AutomationOutboundDispatchService } from '../services/automation-outbound-dispatch.service'
import { AutomationMetricsService } from './automation-metrics.service'

type JsonRecord = Record<string, unknown>

@Injectable()
export class AutomationOpsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly executions: FlowExecutionService,
    private readonly actions: AutomationActionDispatchService,
    private readonly outbound: AutomationOutboundDispatchService,
    private readonly metrics: AutomationMetricsService,
  ) {}

  async health(_body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const tenantId = this.requireTenant(ctx)
    const [executions, outbound, actions, sequence, broadcast] = await Promise.all([
      this.statusCounts('lp_flow_execution', tenantId),
      this.statusCounts('lp_automation_outbound_dispatch', tenantId),
      this.statusCounts('lp_automation_action_dispatch', tenantId),
      this.statusCounts('lp_automation_sequence_dispatch', tenantId),
      this.statusCounts('lp_automation_broadcast_recipient', tenantId),
    ])

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      flags: {
        automation: isAutomationEnabled(),
        runtime: isAutomationRuntimeEnabled(),
        trigger: isAutomationTriggerEnabled(),
        actions: isAutomationActionsEnabled(),
        sequence: isAutomationSequenceEnabled(),
        broadcast: isAutomationBroadcastEnabled(),
        http: isAutomationHttpEnabled(),
        richMessage: isAutomationRichMessageEnabled(),
      },
      counts: { executions, outbound, actions, sequence, broadcast },
    }
  }

  metricsSnapshot(_body: JsonRecord, ctx: LadiflowRpcContext): JsonRecord {
    const tenantId = this.requireTenant(ctx)
    return this.metrics.snapshot(tenantId)
  }

  async retryExecution(body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const tenantId = this.requireTenant(ctx)
    const executionId = this.requiredString(body.execution_id ?? body.executionId, 'execution_id')
    const current = await this.executions.find(tenantId, executionId)
    if (!current || current.status !== 'FAILED') throw new NotFoundException('Failed automation execution not found')
    const [actionDispatches, outboundDispatches] = await Promise.all([
      this.actions.retryDeadForExecution(tenantId, executionId),
      this.outbound.retryDeadForExecution(tenantId, executionId),
    ])
    const row = await this.executions.retryFailed(tenantId, executionId)
    if (!row) throw new NotFoundException('Failed automation execution not found')
    return { retried: true, executionId, status: row.status, actionDispatches, outboundDispatches }
  }

  async cancelExecution(body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const tenantId = this.requireTenant(ctx)
    const executionId = this.requiredString(body.execution_id ?? body.executionId, 'execution_id')
    const row = await this.executions.cancel(tenantId, executionId, this.string(body.reason) || 'cancelled-by-operator')
    await Promise.allSettled([
      this.actions.cancelForExecution(tenantId, executionId, 'execution-cancelled-by-operator'),
      this.outbound.cancelForExecution(tenantId, executionId, 'execution-cancelled-by-operator'),
    ])
    return { cancelled: true, executionId, status: row.status }
  }

  async retryAction(body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const tenantId = this.requireTenant(ctx)
    const dispatchId = this.requiredString(body.dispatch_id ?? body.dispatchId, 'dispatch_id')
    const dispatch = await this.actions.retryDead(tenantId, dispatchId)
    if (!dispatch) throw new NotFoundException('Dead automation action dispatch not found')
    const execution = await this.executions.find(tenantId, dispatch.executionId)
    if (execution?.status === 'CANCELLED') {
      await this.actions.cancelForExecution(tenantId, dispatch.executionId, 'execution-is-cancelled')
      throw new BadRequestException('Cancelled automation execution cannot be retried')
    }
    if (execution?.status === 'FAILED') await this.executions.retryFailed(tenantId, dispatch.executionId)
    return { retried: true, dispatchId, executionId: dispatch.executionId }
  }

  async retryOutbound(body: JsonRecord, ctx: LadiflowRpcContext): Promise<JsonRecord> {
    const tenantId = this.requireTenant(ctx)
    const dispatchId = this.requiredString(body.dispatch_id ?? body.dispatchId, 'dispatch_id')
    const dispatch = await this.outbound.retryDead(tenantId, dispatchId)
    if (!dispatch) throw new NotFoundException('Dead automation outbound dispatch not found')
    const execution = await this.executions.find(tenantId, dispatch.executionId)
    if (execution?.status === 'CANCELLED') {
      await this.outbound.cancelForExecution(tenantId, dispatch.executionId, 'execution-is-cancelled')
      throw new BadRequestException('Cancelled automation execution cannot be retried')
    }
    if (execution?.status === 'FAILED') await this.executions.retryFailed(tenantId, dispatch.executionId)
    return { retried: true, dispatchId, executionId: dispatch.executionId }
  }

  private async statusCounts(table: string, tenantId: number): Promise<Record<string, number>> {
    const allowed = new Set([
      'lp_flow_execution',
      'lp_automation_outbound_dispatch',
      'lp_automation_action_dispatch',
      'lp_automation_sequence_dispatch',
      'lp_automation_broadcast_recipient',
    ])
    if (!allowed.has(table)) return {}
    const rows = await this.dataSource.query(
      `SELECT status, COUNT(*)::int AS count FROM "${table}" WHERE "tenantId" = $1 GROUP BY status`,
      [tenantId],
    ) as Array<{ status: string; count: number }>
    return Object.fromEntries(rows.map((row) => [String(row.status), Number(row.count)]))
  }

  private requireTenant(ctx: LadiflowRpcContext): number {
    const tenantId = Number(ctx.tenantId)
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      throw new BadRequestException('x-tenant-id is required for automation operations')
    }
    return tenantId
  }

  private requiredString(value: unknown, name: string): string {
    const text = this.string(value)
    if (!text) throw new BadRequestException(`${name} is required`)
    return text
  }

  private string(value: unknown): string {
    return String(value ?? '').trim()
  }
}
