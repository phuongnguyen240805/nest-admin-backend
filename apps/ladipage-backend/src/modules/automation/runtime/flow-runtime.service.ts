import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { FlowEntity } from '../entities'
import { LadiflowGraphAdapterService } from '../graph/ladiflow-graph-adapter.service'
import { AutomationBroadcastRuntimeService } from '../broadcast/automation-broadcast-runtime.service'
import { AutomationSequenceService } from '../sequence/automation-sequence.service'
import type { FlowRunResult, RuntimeFlowStep } from './automation-runtime.types'
import { FlowExecutionService } from './flow-execution.service'
import { FlowNodeExecutorRegistry } from './flow-node-executor.registry'

@Injectable()
export class FlowRuntimeService {
  constructor(
    @InjectRepository(FlowEntity)
    private readonly flows: Repository<FlowEntity>,
    private readonly executions: FlowExecutionService,
    private readonly graphAdapter: LadiflowGraphAdapterService,
    private readonly executorRegistry: FlowNodeExecutorRegistry,
    private readonly sequences: AutomationSequenceService,
    private readonly broadcasts: AutomationBroadcastRuntimeService,
  ) {}

  async run(tenantId: number, executionId: string, options: { terminalOnError?: boolean } = {}): Promise<FlowRunResult> {
    const claimed = await this.executions.claim(tenantId, executionId)
    if (!claimed) {
      const current = await this.executions.find(tenantId, executionId)
      if (!current) return { executionId, status: 'NOOP', currentNodeId: null, reason: 'not-found' }
      if (current.status === 'COMPLETED') return { executionId, status: 'COMPLETED', currentNodeId: null }
      if (current.status === 'FAILED') return { executionId, status: 'FAILED', currentNodeId: current.currentNodeId, reason: current.lastError ?? undefined }
      if (current.status === 'WAITING_REPLY') return { executionId, status: 'WAITING_REPLY', currentNodeId: current.currentNodeId }
      if (current.status === 'WAITING') return { executionId, status: 'WAITING', currentNodeId: current.currentNodeId }
      return { executionId, status: 'NOOP', currentNodeId: current.currentNodeId, reason: 'already-running-or-cancelled' }
    }

    let activeStep: Awaited<ReturnType<FlowExecutionService['createOrGetStep']>> | null = null
    try {
      const flow = await this.flows.findOne({
        where: { tenantId, externalId: claimed.flowExternalId, isDelete: false },
      })
      if (!flow) throw new Error('Automation flow not found')
      if (String(flow.status).toUpperCase() !== 'PUBLISHED') throw new Error('Automation flow is not published')

      const graph = this.graphAdapter.adapt(flow.graph ?? {})
      if (!graph.startStepId || graph.steps.length === 0) {
        await this.completeWithHooks(tenantId, executionId)
        return { executionId, status: 'COMPLETED', currentNodeId: null, reason: 'empty-flow' }
      }

      let currentNodeId = claimed.currentNodeId || graph.startStepId
      let variables = { ...(claimed.variables ?? {}) }
      let context = { ...(claimed.context ?? {}) }
      const maxSteps = this.intEnv('AUTOMATION_MAX_STEPS_PER_EXECUTION', 100, 1, 1000)

      for (let traversed = 0; traversed < maxSteps; traversed += 1) {
        const step = graph.steps.find((item) => item.id === currentNodeId)
        if (!step) throw new Error(`Automation node not found: ${currentNodeId}`)

        activeStep = await this.executions.createOrGetStep({
          tenantId,
          executionId,
          nodeId: step.id,
          nodeType: step.type,
          logicalIteration: 0,
          input: { config: step.config },
        })

        if (activeStep.status === 'COMPLETED') {
          const nextFromOutput = this.stringOrUndefined(activeStep.output?.nextStepId)
          const next = nextFromOutput ?? step.nextStepId ?? null
          if (!next) {
            await this.completeWithHooks(tenantId, executionId)
            return { executionId, status: 'COMPLETED', currentNodeId: null }
          }
          currentNodeId = next
          await this.executions.updateProgress({ tenantId, executionId, currentNodeId, variables, context })
          continue
        }

        const executor = this.executorRegistry.resolve(step.type)
        if (!executor) throw new Error(`Unsupported automation node type: ${step.type}`)
        activeStep = await this.executions.startStep(activeStep)

        const result = await executor.execute(step, {
          tenantId,
          executionId,
          conversationId: claimed.conversationId,
          nodeId: step.id,
          logicalIteration: 0,
          variables,
          context,
          nextStepId: step.nextStepId,
          trueStepId: step.trueStepId,
          falseStepId: step.falseStepId,
        })

        const output = { ...(result.output ?? {}), nextStepId: result.nextStepId ?? null }
        const nextStepId = result.nextStepId ?? null

        if (result.kind === 'CONTINUE') {
          variables = this.mergeRecord(variables, this.record(result.output?.variables))
          context = this.mergeRecord(context, this.record(result.output?.context))
          await this.executions.completeStep(activeStep, output)
          if (!nextStepId) {
            await this.completeWithHooks(tenantId, executionId)
            return { executionId, status: 'COMPLETED', currentNodeId: null }
          }
          currentNodeId = nextStepId
          await this.executions.updateProgress({ tenantId, executionId, currentNodeId, variables, context })
          activeStep = null
          continue
        }

        if (result.kind === 'COMPLETE') {
          await this.executions.completeStep(activeStep, output)
          await this.completeWithHooks(tenantId, executionId)
          return { executionId, status: 'COMPLETED', currentNodeId: null }
        }

        if (result.kind === 'WAIT') {
          const waitMs = Math.max(0, Number(result.waitMs ?? 0))
          await this.executions.waitStep(activeStep, output)
          await this.executions.markWaiting({
            tenantId,
            executionId,
            currentNodeId: nextStepId,
            waitingUntil: new Date(Date.now() + waitMs),
            contextPatch: { waitingNodeId: step.id, waitingReason: 'timer' },
          })
          return { executionId, status: 'WAITING', currentNodeId: nextStepId, reason: 'timer', waitMs, waitingNodeId: step.id }
        }

        if (result.kind === 'WAIT_REPLY') {
          await this.executions.waitStep(activeStep, output)
          await this.executions.markWaitingReply({
            tenantId,
            executionId,
            currentNodeId: nextStepId,
            contextPatch: { waitingNodeId: step.id, waitingReason: 'reply' },
          })
          return { executionId, status: 'WAITING_REPLY', currentNodeId: nextStepId, reason: 'reply', waitingNodeId: step.id }
        }

        if (result.kind === 'DISPATCH') {
          const dispatchId = this.stringOrUndefined(result.output?.dispatchId)
          await this.executions.waitStep(activeStep, output)
          await this.executions.markWaiting({
            tenantId,
            executionId,
            currentNodeId: nextStepId,
            waitingUntil: null,
            contextPatch: { waitingNodeId: step.id, waitingReason: 'outbound-dispatch', outboundDispatchId: dispatchId ?? null },
          })
          return { executionId, status: 'WAITING', currentNodeId: nextStepId, reason: 'outbound-dispatch', waitingNodeId: step.id, dispatchId }
        }
      }

      throw new Error(`Automation exceeded max steps (${maxSteps})`)
    } catch (error) {
      if (activeStep) await this.executions.failStep(activeStep, error).catch(() => undefined)
      const reason = error instanceof Error ? error.message : String(error)
      if (options.terminalOnError === true) {
        await this.failWithHooks(tenantId, executionId, error)
        return {
          executionId,
          status: 'FAILED',
          currentNodeId: (await this.executions.find(tenantId, executionId))?.currentNodeId ?? null,
          reason,
        }
      }
      await this.executions.releaseForRetry(tenantId, executionId, error)
      return {
        executionId,
        status: 'RETRY',
        currentNodeId: (await this.executions.find(tenantId, executionId))?.currentNodeId ?? null,
        reason,
      }
    }
  }

  async failWithHooks(tenantId: number, executionId: string, error: unknown): Promise<void> {
    await this.executions.fail(tenantId, executionId, error)
    await Promise.allSettled([
      this.sequences.onFlowFailed(tenantId, executionId, error),
      this.broadcasts.onFlowFailed(tenantId, executionId, error),
    ])
  }

  private async completeWithHooks(tenantId: number, executionId: string): Promise<void> {
    await this.executions.complete(tenantId, executionId)
    await Promise.allSettled([
      this.sequences.onFlowCompleted(tenantId, executionId),
      this.broadcasts.onFlowCompleted(tenantId, executionId),
    ])
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  }

  private mergeRecord(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
    return Object.keys(patch).length ? { ...base, ...patch } : base
  }

  private stringOrUndefined(value: unknown): string | undefined {
    const text = String(value ?? '').trim()
    return text || undefined
  }

  private intEnv(name: string, fallback: number, min: number, max: number): number {
    const parsed = Number(process.env[name] ?? fallback)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(min, Math.min(max, Math.trunc(parsed)))
  }
}
