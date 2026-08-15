import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ContextIdFactory, ModuleRef } from '@nestjs/core'
import { Interval } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { InjectBullQueue } from '@liora/nest-core'
import { CrmCustomFieldService } from '@liora/crm-core'
import type { Queue } from 'bullmq'
import { ClsService } from 'nestjs-cls'
import { DataSource, Repository } from 'typeorm'

import { CustomerCareService } from '../../customer-care/customer-care.service'
import { CustomerCareAiOrchestratorService } from '../../customer-care-ai/orchestration/customer-care-ai-orchestrator.service'
import type { CreateOrderDto, UpdateOrderLifecycleDto, UpdateOrderStatusDto } from '../../ecom-store/dto/order.dto'
import type { CreateShipmentDto } from '../../ecom-store/dto/shipping.dto'
import { OrderEntity } from '../../ecom-store/entities/order.entity'
import { OrderService } from '../../ecom-store/services/order.service'
import { ShippingService } from '../../ecom-store/shipping/shipping.service'
import { OrderPaymentService } from '../../order-payment/services/order-payment.service'
import { AutomationActionDispatchEntity, FlowExecutionEntity } from '../entities'
import { AUTOMATION_QUEUES } from '../queues/constants'
import { isAutomationActionsEnabled, isAutomationTenantAllowed } from '../runtime/automation-feature-gate'
import { FlowExecutionService } from '../runtime/flow-execution.service'
import { FlowRuntimeService } from '../runtime/flow-runtime.service'
import { AutomationMetricsService } from '../observability/automation-metrics.service'
import { AutomationHttpActionError, AutomationHttpActionService } from './automation-http-action.service'

type JsonRecord = Record<string, unknown>

class AutomationActionCancelledError extends Error {
  constructor() {
    super('Automation execution was cancelled')
    this.name = 'AutomationActionCancelledError'
  }
}

@Injectable()
export class AutomationActionDispatcherService {
  private readonly logger = new Logger(AutomationActionDispatcherService.name)
  private running = false

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AutomationActionDispatchEntity)
    private readonly dispatches: Repository<AutomationActionDispatchEntity>,
    private readonly executions: FlowExecutionService,
    private readonly runtime: FlowRuntimeService,
    private readonly http: AutomationHttpActionService,
    private readonly metrics: AutomationMetricsService,
    private readonly cls: ClsService,
    private readonly moduleRef: ModuleRef,
    @InjectBullQueue(AUTOMATION_QUEUES.FLOW)
    private readonly flowQueue: Queue,
  ) {}

  @Interval(1_000)
  async tick(): Promise<void> {
    if (!isAutomationActionsEnabled() || this.running) return
    this.running = true
    try {
      const limit = this.intEnv('AUTOMATION_ACTION_BATCH_SIZE', 10, 1, 50)
      for (let index = 0; index < limit; index += 1) {
        const dispatch = await this.claimOne()
        if (!dispatch) break
        await this.deliver(dispatch)
      }
    } catch (error) {
      this.logger.error('Automation action dispatcher failed', error instanceof Error ? error.stack : error)
    } finally {
      this.running = false
    }
  }

  private async claimOne(): Promise<AutomationActionDispatchEntity | null> {
    const leaseMs = this.intEnv('AUTOMATION_ACTION_LEASE_MS', 60_000, 10_000, 10 * 60_000)
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(AutomationActionDispatchEntity)
      const row = await repo.createQueryBuilder('dispatch')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where("dispatch.status = 'PENDING' OR (dispatch.status = 'RUNNING' AND dispatch.available_at <= NOW())")
        .andWhere('dispatch.available_at <= NOW()')
        .orderBy('dispatch.available_at', 'ASC')
        .getOne()
      if (!row) return null
      row.status = 'RUNNING'
      row.attemptCount += 1
      row.availableAt = new Date(Date.now() + leaseMs)
      row.lastError = null
      return repo.save(row)
    })
  }

  private async deliver(dispatch: AutomationActionDispatchEntity): Promise<void> {
    const startedAt = Date.now()
    if (!isAutomationActionsEnabled() || !isAutomationTenantAllowed(dispatch.tenantId)) {
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
        this.metrics.recordAction(dispatch.tenantId, 'cancelled', Date.now() - startedAt)
        return
      }

      const result = await this.runInTenant(dispatch.tenantId, () => this.perform(dispatch, execution))
      const latestExecution = await this.executions.find(dispatch.tenantId, dispatch.executionId)
      if (!latestExecution || latestExecution.status === 'CANCELLED') {
        dispatch.status = 'CANCELLED'
        dispatch.result = this.record(result)
        dispatch.completedAt = new Date()
        dispatch.lastError = 'execution-cancelled-after-action-started'
        await this.dispatches.save(dispatch)
        this.metrics.recordAction(dispatch.tenantId, 'cancelled', Date.now() - startedAt)
        return
      }
      dispatch.status = 'COMPLETED'
      dispatch.result = this.record(result)
      dispatch.completedAt = new Date()
      dispatch.lastError = null
      await this.dispatches.save(dispatch)

      await this.executions.completeStepByNode({
        tenantId: dispatch.tenantId,
        executionId: dispatch.executionId,
        nodeId: dispatch.nodeId,
        logicalIteration: dispatch.logicalIteration,
        outputPatch: { dispatchId: dispatch.dispatchId, actionType: dispatch.actionType, actionResult: dispatch.result },
      })
      await this.executions.resume({
        tenantId: dispatch.tenantId,
        executionId: dispatch.executionId,
        contextPatch: {
          waitingNodeId: null,
          waitingReason: null,
          actionDispatchId: dispatch.dispatchId,
          lastActionResult: dispatch.result,
        },
        variablePatch: dispatch.resultVariable ? { [dispatch.resultVariable]: dispatch.result } : {},
      })
      await this.flowQueue.add(
        'run',
        { tenantId: dispatch.tenantId, executionId: dispatch.executionId },
        { jobId: `automation-flow-${dispatch.executionId}-action-${dispatch.dispatchId}` },
      )
      this.metrics.recordAction(dispatch.tenantId, 'completed', Date.now() - startedAt)
    } catch (error) {
      await this.handleFailure(dispatch, error)
      const outcome = dispatch.status === 'DEAD' ? 'dead' : dispatch.status === 'CANCELLED' ? 'cancelled' : 'retry'
      this.metrics.recordAction(dispatch.tenantId, outcome, Date.now() - startedAt)
    }
  }

  private async perform(dispatch: AutomationActionDispatchEntity, execution: FlowExecutionEntity): Promise<unknown> {
    const type = this.normalize(dispatch.actionType)
    if (type === 'BATCH') return this.performBatch(dispatch, execution)
    return this.performSingle(type, dispatch.payload ?? {}, dispatch, execution)
  }

  private async performBatch(dispatch: AutomationActionDispatchEntity, execution: FlowExecutionEntity): Promise<JsonRecord> {
    const steps = this.array(dispatch.payload?.steps)
    if (!steps.length) throw new BadRequestException('Automation action batch is empty')
    const progress = this.record(dispatch.result)
    const completed = new Set(this.numberArray(progress.completedIndexes))
    const results = Array.isArray(progress.results) ? [...progress.results] : []

    for (let index = 0; index < steps.length; index += 1) {
      if (completed.has(index)) continue
      const latest = await this.executions.find(dispatch.tenantId, dispatch.executionId)
      if (!latest || latest.status === 'CANCELLED') throw new AutomationActionCancelledError()
      const step = this.record(steps[index])
      const details = this.record(step.details ?? step.config)
      const type = this.normalize(step.actionType ?? step.action ?? step.stepType ?? step.type)
      if (!type) throw new BadRequestException(`Automation batch action #${index + 1} has no type`)
      const result = await this.performSingle(type, { ...step, ...details }, dispatch, execution)
      results[index] = result
      completed.add(index)
      dispatch.result = { completedIndexes: [...completed].sort((a, b) => a - b), results }
      await this.dispatches.save(dispatch)
    }

    return { completedIndexes: [...completed].sort((a, b) => a - b), results }
  }

  private async performSingle(
    rawType: string,
    payload: JsonRecord,
    dispatch: AutomationActionDispatchEntity,
    execution: FlowExecutionEntity,
  ): Promise<unknown> {
    const normalizedRawType = this.normalize(rawType)
    const type = this.aliasAction(normalizedRawType)
    const conversationId = this.string(payload.conversationId) || dispatch.conversationId || execution.conversationId

    if (type === 'ADD_TAG' || type === 'REMOVE_TAG') {
      if (!conversationId) throw new BadRequestException(`${type} requires conversationId`)
      const tags = this.array(payload.tags ?? payload.tagIds ?? payload.tagNames ?? payload.inputTagIds ?? payload.inputTags)
        .map((item) => typeof item === 'number' ? item : String(item ?? '').trim())
        .filter((item) => typeof item === 'number' || Boolean(item)) as Array<string | number>
      if (!tags.length) throw new BadRequestException(`${type} requires tags`)
      const customerCare = await this.resolve(CustomerCareService)
      return customerCare.setTags(conversationId, tags, type === 'ADD_TAG' ? 'add' : 'remove')
    }

    if (type === 'ASSIGN_AGENT' || type === 'UNASSIGN_AGENT') {
      if (!conversationId) throw new BadRequestException(`${type} requires conversationId`)
      const assigneeId = type === 'UNASSIGN_AGENT' ? null : this.requiredInt(payload.assigneeId ?? payload.userId ?? payload.assignedId, 'assigneeId')
      const customerCare = await this.resolve(CustomerCareService)
      return customerCare.setAssignee(conversationId, assigneeId)
    }

    if (type === 'SET_CUSTOM_FIELD') {
      const fieldId = this.requiredString(payload.fieldId ?? payload.customFieldId ?? payload.inputFieldId, 'fieldId')
      const operation = this.string(payload.operation)
      if (operation && !['SET', 'O01'].includes(operation.toUpperCase())) {
        throw new BadRequestException('SET_CUSTOM_FIELD currently supports only the set operation')
      }
      const triggerEvent = this.record(execution.context?.triggerEvent)
      const contact = this.record(triggerEvent.contact)
      const personId = this.string(payload.personId ?? payload.crmPersonId ?? contact.crmContactId)
      const opportunityId = this.string(payload.opportunityId)
      if (!personId && !opportunityId) {
        throw new BadRequestException('SET_CUSTOM_FIELD requires personId/opportunityId or a linked CRM person')
      }
      const customFields = await this.resolve(CrmCustomFieldService)
      return customFields.setValue({
        fieldId,
        personId: personId || null,
        opportunityId: opportunityId || null,
        value: payload.value == null ? null : String(payload.value),
      })
    }

    if (type === 'CREATE_ORDER') {
      const orders = await this.resolve(OrderService)
      const source = `automation:${dispatch.dispatchId}`
      const existing = await this.dataSource.getRepository(OrderEntity).findOne({
        where: { tenantId: dispatch.tenantId, source },
      })
      if (existing) return orders.detail(existing.id)
      const orderPayload = this.validateCreateOrderPayload(this.record(payload.order ?? payload))
      const dto = { ...orderPayload, source } as unknown as CreateOrderDto
      return orders.create(dto)
    }

    if (type === 'UPDATE_ORDER') {
      const orderId = this.requiredInt(payload.orderId, 'orderId')
      const orders = await this.resolve(OrderService)
      let result: unknown = null
      if (payload.status != null) {
        result = await orders.updateStatus(orderId, { status: String(payload.status) } as unknown as UpdateOrderStatusDto)
      }
      if (payload.paymentStatus != null) {
        throw new BadRequestException('UPDATE_ORDER cannot mutate paymentStatus; payment webhook/service remains source-of-truth')
      }
      const lifecycleKeys = ['businessStatus', 'fulfillmentStatus']
      if (lifecycleKeys.some((key) => payload[key] != null)) {
        result = await orders.updateLifecycle(orderId, {
          businessStatus: payload.businessStatus,
          fulfillmentStatus: payload.fulfillmentStatus,
        } as unknown as UpdateOrderLifecycleDto)
      }
      return result ?? orders.detail(orderId)
    }

    if (type === 'CREATE_PAYMENT') {
      const orderId = this.requiredInt(payload.orderId, 'orderId')
      const payments = await this.resolve(OrderPaymentService)
      const provider = (normalizedRawType === 'CREATE_COD_PAYMENT' ? 'cod' : normalizedRawType === 'CREATE_SEPAY_PAYMENT' ? 'sepay' : this.string(payload.provider)).toLowerCase()
      const dto = { idempotencyKey: this.string(payload.idempotencyKey) || `automation:${dispatch.dispatchId}` }
      if (provider === 'cod') return payments.createCod(orderId, dto)
      if (provider === 'sepay') return payments.createSepay(orderId, dto)
      throw new BadRequestException('CREATE_PAYMENT provider must be sepay or cod')
    }

    if (type === 'CHECK_PAYMENT') {
      const orderId = this.requiredInt(payload.orderId, 'orderId')
      const payments = await this.resolve(OrderPaymentService)
      const paymentId = this.optionalInt(payload.paymentId)
      return paymentId ? payments.get(orderId, paymentId) : payments.list(orderId)
    }

    if (type === 'BOOK_SHIPPING') {
      const orderId = this.requiredInt(payload.orderId, 'orderId')
      const shipping = await this.resolve(ShippingService)
      const dto = {
        ...this.record(payload.shipment ?? payload),
        idempotencyKey: this.string(payload.idempotencyKey) || `automation:${dispatch.dispatchId}`,
      } as unknown as CreateShipmentDto
      return shipping.create(orderId, dto)
    }

    if (type === 'CHECK_SHIPPING') {
      const orderId = this.requiredInt(payload.orderId, 'orderId')
      const shipping = await this.resolve(ShippingService)
      if (payload.refresh === true) return shipping.refresh(orderId)
      return shipping.detailForOrder(orderId)
    }

    if (type === 'AI_REPLY' || type === 'AI_ANALYZE') {
      if (!conversationId) throw new BadRequestException(`${type} requires conversationId`)
      const ai = await this.resolve(CustomerCareAiOrchestratorService)
      const triggerEvent = this.record(execution.context?.triggerEvent)
      const message = this.record(triggerEvent.message)
      const triggerMessageId = this.string(payload.triggerMessageId ?? message.id ?? message.externalMessageId) || undefined
      if (type === 'AI_ANALYZE') return ai.analyze(conversationId, 0, { triggerMessageId })
      return ai.reply(conversationId, 0, {
        instruction: this.string(payload.instruction) || undefined,
        triggerMessageId,
      })
    }

    if (type === 'HTTP_REQUEST' || type === 'WEBHOOK') {
      return this.http.request(payload, dispatch.dispatchId, type === 'WEBHOOK')
    }

    throw new BadRequestException(`Unsupported automation action: ${type}`)
  }

  private async handleFailure(dispatch: AutomationActionDispatchEntity, error: unknown): Promise<void> {
    const maxAttempts = this.intEnv('AUTOMATION_ACTION_MAX_ATTEMPTS', 5, 1, 20)
    const message = error instanceof Error ? error.message : String(error)
    if (error instanceof AutomationActionCancelledError) {
      dispatch.status = 'CANCELLED'
      dispatch.completedAt = new Date()
      dispatch.lastError = 'execution-cancelled'
      await this.dispatches.save(dispatch)
      return
    }
    const candidate = error as { getStatus?: () => number } | null
    const httpStatus = candidate && typeof candidate.getStatus === 'function' ? Number(candidate.getStatus()) : 0
    const retryable = error instanceof AutomationHttpActionError
      ? error.retryable
      : !(httpStatus >= 400 && httpStatus < 500 && httpStatus !== 408 && httpStatus !== 429)
    dispatch.lastError = message.slice(0, 2_000)

    if (!retryable || dispatch.attemptCount >= maxAttempts) {
      dispatch.status = 'DEAD'
      dispatch.completedAt = new Date()
      await this.dispatches.save(dispatch)
      await this.runtime.failWithHooks(dispatch.tenantId, dispatch.executionId, error).catch(() => undefined)
      return
    }

    dispatch.status = 'PENDING'
    dispatch.availableAt = new Date(Date.now() + Math.min(5 * 60_000, 2_000 * 2 ** Math.max(0, dispatch.attemptCount - 1)))
    await this.dispatches.save(dispatch)
  }

  private runInTenant<T>(tenantId: number, fn: () => Promise<T>): Promise<T> {
    return this.cls.run(async () => {
      this.cls.set('tenantId', tenantId)
      return fn()
    })
  }

  private resolve<T>(token: new (...args: any[]) => T): Promise<T> {
    return this.moduleRef.resolve(token, ContextIdFactory.create(), { strict: false }) as Promise<T>
  }

  private validateCreateOrderPayload(payload: JsonRecord): JsonRecord {
    const customerName = this.requiredString(payload.customerName, 'customerName')
    const customerPhone = this.requiredString(payload.customerPhone, 'customerPhone')
    const rawItems = this.array(payload.items)
    if (!rawItems.length) throw new BadRequestException('CREATE_ORDER requires at least one item')
    const items = rawItems.map((item, index) => {
      const row = this.record(item)
      const productName = this.requiredString(row.productName, `items[${index}].productName`)
      const quantity = Number(row.quantity)
      const unitPrice = Number(row.unitPrice)
      if (!Number.isInteger(quantity) || quantity <= 0) throw new BadRequestException(`items[${index}].quantity must be a positive integer`)
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new BadRequestException(`items[${index}].unitPrice must be non-negative`)
      return { ...row, productName, quantity, unitPrice }
    })
    return { ...payload, customerName, customerPhone, items }
  }

  private aliasAction(value: unknown): string {
    const type = this.normalize(value)
    const aliases: Record<string, string> = {
      ADD_TAGS: 'ADD_TAG',
      ADD_CONTACT_TAG: 'ADD_TAG',
      REMOVE_TAGS: 'REMOVE_TAG',
      REMOVE_CONTACT_TAG: 'REMOVE_TAG',
      ASSIGN_CONVERSATION: 'ASSIGN_AGENT',
      UNASSIGN_CONVERSATION: 'UNASSIGN_AGENT',
      SET_CUSTOM_FIELD_VALUE: 'SET_CUSTOM_FIELD',
      CALL_API: 'HTTP_REQUEST',
      CREATE_SEPAY_PAYMENT: 'CREATE_PAYMENT',
      CREATE_COD_PAYMENT: 'CREATE_PAYMENT',
    }
    return aliases[type] ?? type
  }

  private normalize(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase()
  }

  private record(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
  }

  private numberArray(value: unknown): number[] {
    return this.array(value).map(Number).filter((item) => Number.isInteger(item) && item >= 0)
  }

  private string(value: unknown): string {
    return typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  }

  private requiredString(value: unknown, name: string): string {
    const text = this.string(value)
    if (!text) throw new BadRequestException(`${name} is required`)
    return text
  }

  private requiredInt(value: unknown, name: string): number {
    const parsed = this.optionalInt(value)
    if (!parsed) throw new BadRequestException(`${name} must be a positive integer`)
    return parsed
  }

  private optionalInt(value: unknown): number | null {
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }

  private intEnv(name: string, fallback: number, min: number, max: number): number {
    const parsed = Number(process.env[name] ?? fallback)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(min, Math.min(max, Math.trunc(parsed)))
  }
}
