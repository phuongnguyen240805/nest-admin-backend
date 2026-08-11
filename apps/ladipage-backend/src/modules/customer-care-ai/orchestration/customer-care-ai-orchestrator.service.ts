import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash } from 'node:crypto'
import { Repository } from 'typeorm'

import { AI_PROVIDER_GATEWAY, type AiChatMessage, type AiProviderGateway } from '@liora/ai-gateway'
import { TenantContextService } from '@liora/nest-core'

import { CustomerCareContextService } from '../../customer-care-context/customer-care-context.service'
import { ContextBudgetService } from '../../customer-care-context/context-budget.service'
import { DomainEventOutboxService } from '../../domain-events/domain-event-outbox.service'
import { CustomerCareAiJobEntity, CustomerCareAiResultEntity, CustomerCareAiToolCallEntity } from '../entities'
import { CustomerCareAiToolRegistry } from '../tools/customer-care-ai-tool.registry'
import { CustomerCareAiActionService } from '../actions/customer-care-ai-action.service'
import { CustomerCareAiConfigService } from '../config/customer-care-ai-config.service'
import { CustomerCareAiMetricsService } from '../observability/customer-care-ai-metrics.service'
import { CUSTOMER_CARE_PROMPT_VERSION, buildCustomerCareSystemPrompt } from '../prompts/customer-care-system.prompt'

@Injectable()
export class CustomerCareAiOrchestratorService {
  constructor(
    @Inject(AI_PROVIDER_GATEWAY) private readonly gateway: AiProviderGateway,
    private readonly tenantContext: TenantContextService,
    private readonly contextService: CustomerCareContextService,
    private readonly tools: CustomerCareAiToolRegistry,
    private readonly budget: ContextBudgetService,
    private readonly domainEvents: DomainEventOutboxService,
    private readonly actions: CustomerCareAiActionService,
    private readonly configService: CustomerCareAiConfigService,
    private readonly metrics: CustomerCareAiMetricsService,
    @InjectRepository(CustomerCareAiJobEntity) private readonly jobs: Repository<CustomerCareAiJobEntity>,
    @InjectRepository(CustomerCareAiResultEntity) private readonly results: Repository<CustomerCareAiResultEntity>,
    @InjectRepository(CustomerCareAiToolCallEntity) private readonly toolCalls: Repository<CustomerCareAiToolCallEntity>,
  ) {}

  reply(conversationId: string, actorUserId: number, input?: { instruction?: string; triggerMessageId?: string }) {
    return this.run('reply', conversationId, actorUserId, input)
  }

  analyze(conversationId: string, actorUserId: number, input?: { triggerMessageId?: string }) {
    return this.run('analysis', conversationId, actorUserId, input)
  }

  async getJob(jobId: string) {
    const tenantId = this.requireTenantId()
    const job = await this.jobs.findOne({ where: { id: jobId, tenantId } })
    if (!job) throw new NotFoundException('AI job not found')
    const results = await this.results.find({ where: { tenantId, jobId }, order: { createdAt: 'ASC' } })
    const toolCalls = await this.toolCalls.find({ where: { tenantId, jobId }, order: { createdAt: 'ASC' } })
    return { job, results, toolCalls }
  }

  private async run(
    mode: 'reply' | 'analysis',
    conversationId: string,
    actorUserId: number,
    input?: { instruction?: string; triggerMessageId?: string },
  ) {
    const tenantId = this.requireTenantId()
    const config = await this.configService.getOrCreate()
    if (!config.enabled) throw new ForbiddenException('Customer Care AI is disabled for this tenant')

    let job = await this.jobs.save(this.jobs.create({
      tenantId, conversationId, triggerMessageId: input?.triggerMessageId ?? null,
      jobType: mode, status: 'running', priority: 10, attempts: 1,
      startedAt: new Date(), completedAt: null, errorCode: null, errorMessage: null,
    }))
    const startedAt = Date.now()

    try {
      const context = await this.contextService.build({
        conversationId, actorUserId, recentMessageLimit: 35, timelineLimit: 140,
      })
      const messages: AiChatMessage[] = [
        { role: 'system', content: buildCustomerCareSystemPrompt(mode) },
        {
          role: 'user',
          content: JSON.stringify({
            task: mode,
            instruction: input?.instruction ?? null,
            authoritativeContext: context,
          }),
        },
      ]

      let finalText = ''
      let finalJson: any = undefined
      let finalTrace: any = undefined
      let finalUsage: any = undefined

      for (let round = 0; round < 4; round += 1) {
        const response = await this.gateway.generateText({
          workspaceId: String(tenantId),
          tenantId,
          invocationId: job.id,
          idempotencyKey: `${job.id}:${round}`,
          sessionId: `customer-care:${conversationId}`,
          capability: 'text',
          modelHint: config.model ?? undefined,
          timeoutMs: Number(process.env.CUSTOMER_CARE_AI_TIMEOUT_MS ?? 60_000),
          metadata: { source: 'customer-care', toolName: mode },
          messages,
          tools: this.tools.definitions(),
          toolChoice: 'auto',
          responseFormat: 'text',
          temperature: Number(config.temperature ?? 0.2),
          maxTokens: config.maxOutputTokens || 1200,
        })
        finalTrace = response.trace
        finalUsage = response.usage

        if (response.toolCalls?.length) {
          messages.push({ role: 'assistant', content: response.text || '', toolCalls: response.toolCalls })
          for (const call of response.toolCalls) {
            const execution = await this.executeToolCall(job.id, call.function.name, call.function.arguments, {
              tenantId, conversationId, actorUserId, jobId: job.id,
            })
            messages.push({
              role: 'tool',
              toolCallId: call.id,
              name: call.function.name,
              content: JSON.stringify(execution),
            })
          }
          continue
        }

        finalText = response.text
        finalJson = response.json ?? this.tryParseJson(response.text)
        break
      }

      if (!finalText && !finalJson) throw new BadRequestException('AI did not produce a final answer')
      const normalized = this.normalizeResult(mode, finalJson, finalText, context)
      const result = await this.results.save(this.results.create({
        jobId: job.id, tenantId, conversationId, resultType: mode,
        content: normalized.reply || normalized.summary || finalText || '',
        structuredResult: normalized,
        model: finalTrace?.model ?? config.model ?? null,
        gateway: finalTrace?.gateway ?? null,
        promptVersion: CUSTOMER_CARE_PROMPT_VERSION,
        usage: finalUsage ?? {},
        latencyMs: Date.now() - startedAt,
      }))
      const proposedActions = mode === 'reply' && normalized.proposedActions.length
        ? await this.actions.proposeFromModel({
            conversationId,
            jobId: job.id,
            model: finalTrace?.model ?? config.model ?? null,
            proposals: normalized.proposedActions,
          })
        : []
      job.status = 'completed'
      job.completedAt = new Date()
      job = await this.jobs.save(job)
      await this.domainEvents.append({
        tenantId, aggregateType: 'conversation', aggregateId: conversationId,
        eventType: mode === 'reply' ? 'ai.reply.generated' : 'ai.analysis.completed',
        payload: { conversationId, jobId: job.id, resultId: result.id, needsHuman: normalized.needsHuman },
      })
      this.metrics.recordJob({ mode, success: true, latencyMs: Date.now() - startedAt })
      return { jobId: job.id, resultId: result.id, ...normalized, proposedActions, usage: finalUsage ?? {}, trace: this.safeTrace(finalTrace) }
    } catch (error) {
      job.status = 'failed'
      job.completedAt = new Date()
      job.errorCode = error instanceof Error ? error.name : 'AI_ERROR'
      job.errorMessage = error instanceof Error ? error.message : String(error)
      await this.jobs.save(job).catch(() => undefined)
      this.metrics.recordJob({ mode, success: false, latencyMs: Date.now() - startedAt })
      throw error
    }
  }

  private async executeToolCall(
    jobId: string,
    name: string,
    rawArgs: string,
    context: { tenantId: number; conversationId: string; actorUserId: number; jobId: string },
  ) {
    const startedAt = Date.now()
    let args: Record<string, unknown> = {}
    try { args = rawArgs.trim() ? JSON.parse(rawArgs) : {} } catch { args = {} }
    try {
      const result = await this.tools.execute(name, rawArgs, context)
      const sanitized = this.budget.sanitize(result)
      const serialized = JSON.stringify(sanitized)
      await this.toolCalls.save(this.toolCalls.create({
        tenantId: context.tenantId, jobId, conversationId: context.conversationId,
        toolName: name, arguments: this.budget.sanitize(args),
        resultSummary: this.summarizeToolResult(sanitized),
        resultHash: createHash('sha256').update(serialized).digest('hex'),
        status: 'success', durationMs: Date.now() - startedAt, error: null,
      }))
      this.metrics.recordTool({ success: true, latencyMs: Date.now() - startedAt })
      return sanitized
    } catch (error) {
      await this.toolCalls.save(this.toolCalls.create({
        tenantId: context.tenantId, jobId, conversationId: context.conversationId,
        toolName: name, arguments: this.budget.sanitize(args), resultSummary: null, resultHash: null,
        status: 'failed', durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      })).catch(() => undefined)
      this.metrics.recordTool({ success: false, latencyMs: Date.now() - startedAt })
      return { error: 'TOOL_FAILED', message: error instanceof Error ? error.message : String(error) }
    }
  }

  private normalizeResult(mode: 'reply' | 'analysis', value: any, fallback: string, context: any) {
    const data = value && typeof value === 'object' ? value : {}
    const confidence = Number(data.confidence)
    return {
      reply: mode === 'reply' ? String(data.reply ?? fallback ?? '') : String(data.reply ?? ''),
      intent: String(data.intent ?? 'UNKNOWN'),
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
      needsHuman: Boolean(data.needsHuman),
      summary: String(data.summary ?? (mode === 'analysis' ? fallback : '')),
      suggestedNextAction: data.suggestedNextAction ? String(data.suggestedNextAction) : null,
      proposedActions: Array.isArray(data.proposedActions)
        ? data.proposedActions.slice(0, 3).filter((item: unknown) => item && typeof item === 'object')
        : [],
      facts: this.authoritativeFacts(context),
    }
  }

  private authoritativeFacts(context: any) {
    const primary = context?.primaryOrder
    if (!primary?.order) return []
    const facts: Array<Record<string, unknown>> = [{
      type: 'order', id: primary.order.id, label: primary.order.code,
      businessStatus: primary.order.businessStatus, paymentStatus: primary.order.paymentStatus, fulfillmentStatus: primary.order.fulfillmentStatus,
    }]
    for (const payment of primary.payments ?? []) facts.push({ type: 'payment', id: payment.id, label: payment.status, provider: payment.provider, paidAt: payment.paidAt ?? null })
    if (primary.shipment) facts.push({ type: 'shipment', id: primary.shipment.id, label: primary.shipment.status, provider: primary.shipment.provider, trackingCode: primary.shipment.trackingCode ?? null, estimatedDeliveryAt: primary.shipment.estimatedDeliveryAt ?? null })
    return facts
  }


  private summarizeToolResult(value: unknown): Record<string, unknown> {
    if (Array.isArray(value)) return { kind: 'array', count: value.length }
    if (value && typeof value === 'object') return { kind: 'object', keys: Object.keys(value as object).slice(0, 30) }
    return { kind: typeof value }
  }

  private tryParseJson(text: string): unknown {
    const trimmed = String(text ?? '').trim()
    if (!trimmed) return undefined
    const candidates = [trimmed]
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
    if (fenced?.[1]) candidates.push(fenced[1].trim())
    const first = trimmed.indexOf('{')
    const last = trimmed.lastIndexOf('}')
    if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1))
    for (const candidate of candidates) {
      try { return JSON.parse(candidate) } catch { /* try next candidate */ }
    }
    return undefined
  }
  private safeTrace(trace: any) { return trace ? { gateway: trace.gateway, provider: trace.provider, model: trace.model, latencyMs: trace.latencyMs, fallbackAttempts: trace.fallbackAttempts } : null }
  private requireTenantId(): number { const id = this.tenantContext.getTenantId(); if (id == null) throw new ForbiddenException('Tenant ID is required'); return id }
}
