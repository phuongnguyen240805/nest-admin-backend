import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { randomBytes, randomUUID } from 'node:crypto'
import { DataSource, MoreThan, Repository } from 'typeorm'

import type { LadiflowRpcContext } from '../../ladiflow-rpc/ladiflow-dispatcher.service'
import {
  AutomationSequenceDispatchEntity,
  AutomationSequenceEnrollmentEntity,
  AutomationSequenceEntity,
  AutomationSequenceStepEntity,
  FlowEntity,
} from '../entities'
import { FlowExecutionService } from '../runtime/flow-execution.service'
import { AutomationActionDispatchService } from '../actions/automation-action-dispatch.service'
import { AutomationOutboundDispatchService } from '../services/automation-outbound-dispatch.service'
import { AutomationSequenceTimeService } from './automation-sequence-time.service'

type JsonRecord = Record<string, unknown>

@Injectable()
export class AutomationSequenceService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AutomationSequenceEntity)
    private readonly sequences: Repository<AutomationSequenceEntity>,
    @InjectRepository(AutomationSequenceStepEntity)
    private readonly steps: Repository<AutomationSequenceStepEntity>,
    @InjectRepository(AutomationSequenceEnrollmentEntity)
    private readonly enrollments: Repository<AutomationSequenceEnrollmentEntity>,
    @InjectRepository(AutomationSequenceDispatchEntity)
    private readonly dispatches: Repository<AutomationSequenceDispatchEntity>,
    @InjectRepository(FlowEntity)
    private readonly flows: Repository<FlowEntity>,
    private readonly executions: FlowExecutionService,
    private readonly outbound: AutomationOutboundDispatchService,
    private readonly actions: AutomationActionDispatchService,
    private readonly time: AutomationSequenceTimeService,
  ) {}

  async list(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const limit = this.positiveInt(body.limit, 100)
    const page = this.positiveInt(body.page, 1)
    const [items, total] = await this.sequences.findAndCount({
      where: { tenantId, isDelete: false },
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    })
    return { total, limit, is_empty: total === 0, items: await Promise.all(items.map((item) => this.mapSequence(item))) }
  }

  async create(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const payload = this.record(body.sequence ?? body.data ?? body)
    const row = await this.sequences.save(this.sequences.create({
      tenantId,
      externalId: this.stringOr(payload._id, this.newExternalId()),
      name: this.requiredString(payload.name, 'name'),
      status: 'DRAFT',
      active: payload.active !== false,
      timezone: this.validTimezone(this.stringOr(payload.timezone, 'UTC')),
      config: this.record(payload.config),
      isDelete: false,
    }))
    return { sequence: await this.mapSequence(row) }
  }

  async update(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const payload = this.record(body.sequence ?? body.data ?? body)
    const id = this.requiredString(payload._id ?? body.sequence_id ?? body.id, 'sequence_id')
    const row = await this.requireSequence(tenantId, id)
    if (payload.name != null) row.name = this.requiredString(payload.name, 'name')
    if (typeof payload.active === 'boolean') row.active = payload.active
    if (payload.timezone != null) row.timezone = this.validTimezone(String(payload.timezone))
    if (payload.config != null) row.config = this.record(payload.config)
    await this.sequences.save(row)
    return { sequence: await this.mapSequence(row) }
  }

  async upsertStep(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const payload = this.record(body.step ?? body.data ?? body)
    const sequenceId = this.requiredString(payload.sequence_id ?? payload.sequenceId ?? body.sequence_id, 'sequence_id')
    await this.requireSequence(tenantId, sequenceId)
    const flowId = this.requiredString(payload.flow_id ?? payload.flowId, 'flow_id')
    await this.requireFlow(tenantId, flowId)
    const order = this.nonNegativeInt(payload.order, 0)
    const externalId = String(payload._id ?? payload.id ?? '').trim()

    let row = externalId
      ? await this.steps.findOne({ where: { tenantId, externalId, sequenceExternalId: sequenceId } })
      : await this.steps.findOne({ where: { tenantId, sequenceExternalId: sequenceId, order } })

    row ||= this.steps.create({ tenantId, externalId: externalId || this.newExternalId(), sequenceExternalId: sequenceId } as AutomationSequenceStepEntity)
    row.flowExternalId = flowId
    row.order = order
    row.delayDays = this.nonNegativeInt(payload.delay_days ?? payload.delayDays, 0)
    row.delayMinutes = this.nonNegativeInt(payload.delay_minutes ?? payload.delayMinutes, 0)
    row.specificDateTime = this.optionalDate(payload.specific_date_time ?? payload.specificDateTime)
    row.isActive = payload.is_active !== false && payload.isActive !== false
    row.anytime = payload.anytime !== false
    row.sendTimeStart = this.optionalTime(payload.send_time_start ?? payload.sendTimeStart)
    row.sendTimeEnd = this.optionalTime(payload.send_time_end ?? payload.sendTimeEnd)
    row.sendDays = this.sendDays(payload.send_days ?? payload.sendDays)
    await this.steps.save(row)
    return { step: this.mapStep(row) }
  }

  async publish(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const id = this.requiredString(body.sequence_id ?? body._id ?? body.id, 'sequence_id')
    const row = await this.requireSequence(tenantId, id)
    const steps = await this.steps.find({ where: { tenantId, sequenceExternalId: id, isActive: true }, order: { order: 'ASC' } })
    if (!steps.length) throw new BadRequestException('Sequence must contain at least one active step')
    for (const step of steps) {
      const flow = await this.requireFlow(tenantId, step.flowExternalId)
      if (String(flow.status).toUpperCase() !== 'PUBLISHED') throw new BadRequestException(`Sequence step ${step.externalId} references an unpublished flow`)
    }
    row.status = 'PUBLISHED'
    row.active = true
    await this.sequences.save(row)
    return { sequence: await this.mapSequence(row) }
  }

  async pause(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const id = this.requiredString(body.sequence_id ?? body._id ?? body.id, 'sequence_id')
    const row = await this.requireSequence(tenantId, id)
    row.status = 'PAUSED'
    row.active = false
    await this.sequences.save(row)
    return { sequence: await this.mapSequence(row) }
  }

  async resume(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const id = this.requiredString(body.sequence_id ?? body._id ?? body.id, 'sequence_id')
    const row = await this.requireSequence(tenantId, id)
    const steps = await this.steps.find({ where: { tenantId, sequenceExternalId: id, isActive: true }, order: { order: 'ASC' } })
    if (!steps.length) throw new BadRequestException('Sequence must contain at least one active step')
    for (const step of steps) {
      const flow = await this.requireFlow(tenantId, step.flowExternalId)
      if (String(flow.status).toUpperCase() !== 'PUBLISHED') {
        throw new BadRequestException(`Sequence step ${step.externalId} references an unpublished flow`)
      }
    }
    row.status = 'PUBLISHED'
    row.active = true
    await this.sequences.save(row)
    return { sequence: await this.mapSequence(row) }
  }

  async enroll(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const sequenceId = this.requiredString(body.sequence_id ?? body.sequenceId, 'sequence_id')
    const conversationId = this.requiredString(body.conversation_id ?? body.conversationId, 'conversation_id')
    const sequence = await this.requireSequence(tenantId, sequenceId)
    if (!sequence.active || sequence.status !== 'PUBLISHED') throw new BadRequestException('Sequence is not published and active')
    const conversation = await this.findConversation(tenantId, conversationId)
    const firstStep = await this.steps.findOne({
      where: { tenantId, sequenceExternalId: sequenceId, isActive: true },
      order: { order: 'ASC' },
    })
    if (!firstStep) throw new BadRequestException('Sequence has no active steps')

    const existing = await this.enrollments.findOne({
      where: { tenantId, sequenceExternalId: sequenceId, conversationId, status: 'ACTIVE' },
    })
    if (existing) return { enrollment: this.mapEnrollment(existing), already_enrolled: true }

    const enrolledAt = new Date()
    const nextRunAt = this.time.calculate(firstStep, enrolledAt, sequence.timezone)
    const enrollment = this.enrollments.create({
      tenantId,
      enrollmentId: randomUUID(),
      sequenceExternalId: sequenceId,
      conversationId,
    } as AutomationSequenceEnrollmentEntity)
    enrollment.contactIdentityId = conversation.contactIdentityId
    enrollment.status = 'ACTIVE'
    enrollment.currentOrder = -1
    enrollment.lastStepId = null
    enrollment.nextStepId = firstStep.externalId
    enrollment.nextRunAt = nextRunAt
    enrollment.enrolledAt = enrolledAt
    enrollment.completedAt = null
    enrollment.lastError = null
    await this.enrollments.save(enrollment)
    await this.ensureDispatch(enrollment, firstStep, nextRunAt)
    return { enrollment: this.mapEnrollment(enrollment), already_enrolled: false }
  }

  async unenroll(body: JsonRecord, ctx: LadiflowRpcContext) {
    const tenantId = this.requireTenant(ctx)
    const enrollmentId = String(body.enrollment_id ?? '').trim()
    const sequenceId = String(body.sequence_id ?? '').trim()
    const conversationId = String(body.conversation_id ?? '').trim()
    const row = enrollmentId
      ? await this.enrollments.findOne({ where: { tenantId, enrollmentId } })
      : await this.enrollments.findOne({ where: { tenantId, sequenceExternalId: sequenceId, conversationId, status: 'ACTIVE' } })
    if (!row) throw new NotFoundException('Sequence enrollment not found')
    row.status = 'CANCELLED'
    row.nextStepId = null
    row.nextRunAt = null
    await this.enrollments.save(row)
    const activeDispatches = await this.dispatches.createQueryBuilder('dispatch')
      .where('dispatch.tenantId = :tenantId', { tenantId })
      .andWhere('dispatch.enrollment_id = :enrollmentId', { enrollmentId: row.enrollmentId })
      .andWhere('dispatch.flow_execution_id IS NOT NULL')
      .andWhere("dispatch.status IN ('RUNNING','QUEUED','PENDING')")
      .getMany()

    await this.dispatches.createQueryBuilder()
      .update()
      .set({ status: 'CANCELLED', completedAt: new Date() })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('enrollment_id = :enrollmentId', { enrollmentId: row.enrollmentId })
      .andWhere("status IN ('PENDING','QUEUED')")
      .execute()

    for (const dispatch of activeDispatches) {
      if (!dispatch.flowExecutionId) continue
      await this.executions.cancel(tenantId, dispatch.flowExecutionId, 'sequence-unenrolled').catch(() => undefined)
      await this.outbound.cancelForExecution(tenantId, dispatch.flowExecutionId, 'sequence-unenrolled').catch(() => undefined)
      await this.actions.cancelForExecution(tenantId, dispatch.flowExecutionId, 'sequence-unenrolled').catch(() => undefined)
      dispatch.status = 'CANCELLED'
      dispatch.completedAt = new Date()
      dispatch.lastError = null
      await this.dispatches.save(dispatch)
    }
    return { cancelled: true, enrollment_id: row.enrollmentId }
  }

  async claimDispatch(tenantId: number, dispatchId: string): Promise<AutomationSequenceDispatchEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(AutomationSequenceDispatchEntity)
      const row = await repo.createQueryBuilder('dispatch')
        .setLock('pessimistic_write')
        .where('dispatch.tenantId = :tenantId', { tenantId })
        .andWhere('dispatch.dispatch_id = :dispatchId', { dispatchId })
        .getOne()
      if (!row) return null
      if (row.status === 'RUNNING' && row.flowExecutionId) return row
      if (!['PENDING', 'QUEUED', 'RUNNING'].includes(row.status)) return null
      row.status = 'RUNNING'
      row.attempts += 1
      row.lastError = null
      return repo.save(row)
    })
  }

  async attachExecution(tenantId: number, dispatchId: string, executionId: string): Promise<void> {
    await this.dispatches.update({ tenantId, dispatchId }, { flowExecutionId: executionId, status: 'RUNNING' })
  }

  async failDispatch(tenantId: number, dispatchId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error)
    const row = await this.dispatches.findOne({ where: { tenantId, dispatchId } })
    if (!row) return
    row.status = 'FAILED'
    row.lastError = message
    row.completedAt = new Date()
    await this.dispatches.save(row)
    const enrollment = await this.enrollments.findOne({ where: { tenantId, enrollmentId: row.enrollmentId } })
    if (enrollment && enrollment.status !== 'CANCELLED') {
      enrollment.status = 'FAILED'
      enrollment.lastError = message
      enrollment.nextRunAt = null
      await this.enrollments.save(enrollment)
    }
  }

  async onFlowCompleted(tenantId: number, flowExecutionId: string): Promise<void> {
    const dispatch = await this.dispatches.findOne({ where: { tenantId, flowExecutionId } })
    if (!dispatch || dispatch.status === 'COMPLETED') return
    const enrollment = await this.enrollments.findOne({ where: { tenantId, enrollmentId: dispatch.enrollmentId } })
    if (!enrollment) return
    if (enrollment.status !== 'ACTIVE') {
      dispatch.status = enrollment.status === 'CANCELLED' ? 'CANCELLED' : dispatch.status
      dispatch.completedAt = new Date()
      await this.dispatches.save(dispatch)
      return
    }
    const sequence = await this.requireSequence(tenantId, dispatch.sequenceExternalId)
    const current = await this.steps.findOne({ where: { tenantId, externalId: dispatch.stepExternalId, sequenceExternalId: dispatch.sequenceExternalId } })
    if (!current) return this.failDispatch(tenantId, dispatch.dispatchId, 'Sequence step not found during completion')

    dispatch.status = 'COMPLETED'
    dispatch.completedAt = new Date()
    dispatch.lastError = null
    await this.dispatches.save(dispatch)

    enrollment.currentOrder = current.order
    enrollment.lastStepId = current.externalId
    const next = await this.steps.findOne({
      where: { tenantId, sequenceExternalId: dispatch.sequenceExternalId, isActive: true, order: MoreThan(current.order) },
      order: { order: 'ASC' },
    })
    if (!next) {
      enrollment.status = 'COMPLETED'
      enrollment.nextStepId = null
      enrollment.nextRunAt = null
      enrollment.completedAt = new Date()
      await this.enrollments.save(enrollment)
      return
    }

    const runAt = this.time.calculate(next, dispatch.completedAt, sequence.timezone)
    enrollment.nextStepId = next.externalId
    enrollment.nextRunAt = runAt
    await this.enrollments.save(enrollment)
    await this.ensureDispatch(enrollment, next, runAt)
  }

  async onFlowFailed(tenantId: number, flowExecutionId: string, error: unknown): Promise<void> {
    const dispatch = await this.dispatches.findOne({ where: { tenantId, flowExecutionId } })
    if (!dispatch) return
    const enrollment = await this.enrollments.findOne({ where: { tenantId, enrollmentId: dispatch.enrollmentId } })
    if (enrollment?.status === 'CANCELLED') {
      dispatch.status = 'CANCELLED'
      dispatch.completedAt = new Date()
      dispatch.lastError = null
      await this.dispatches.save(dispatch)
      return
    }
    await this.failDispatch(tenantId, dispatch.dispatchId, error)
  }

  async dueDispatches(limit = 50): Promise<AutomationSequenceDispatchEntity[]> {
    return this.dispatches.createQueryBuilder('dispatch')
      .innerJoin(
        AutomationSequenceEntity,
        'sequence',
        'sequence.tenantId = dispatch.tenantId AND sequence._id = dispatch.sequence_id',
      )
      .where("dispatch.status = 'PENDING'")
      .andWhere('dispatch.run_at <= NOW()')
      .andWhere("sequence.status = 'PUBLISHED'")
      .andWhere('sequence.active = true')
      .andWhere('sequence.is_delete = false')
      .orderBy('dispatch.run_at', 'ASC')
      .take(limit)
      .getMany()
  }

  async markQueued(tenantId: number, dispatchId: string): Promise<void> {
    await this.dispatches.createQueryBuilder()
      .update()
      .set({ status: 'QUEUED' })
      .where('tenantId = :tenantId', { tenantId })
      .andWhere('dispatch_id = :dispatchId', { dispatchId })
      .andWhere("status = 'PENDING'")
      .execute()
  }

  async getStepForDispatch(dispatch: AutomationSequenceDispatchEntity): Promise<AutomationSequenceStepEntity | null> {
    return this.steps.findOne({
      where: { tenantId: dispatch.tenantId, sequenceExternalId: dispatch.sequenceExternalId, externalId: dispatch.stepExternalId, isActive: true },
    })
  }

  async getEnrollment(tenantId: number, enrollmentId: string) {
    return this.enrollments.findOne({ where: { tenantId, enrollmentId } })
  }

  async getSequenceForDispatch(dispatch: AutomationSequenceDispatchEntity): Promise<AutomationSequenceEntity | null> {
    return this.sequences.findOne({
      where: { tenantId: dispatch.tenantId, externalId: dispatch.sequenceExternalId, isDelete: false },
    })
  }

  async deferDispatch(tenantId: number, dispatchId: string, delayMs = 60_000): Promise<void> {
    const row = await this.dispatches.findOne({ where: { tenantId, dispatchId } })
    if (!row || row.flowExecutionId || ['COMPLETED', 'FAILED', 'CANCELLED'].includes(row.status)) return
    row.status = 'PENDING'
    row.runAt = new Date(Date.now() + Math.max(1_000, delayMs))
    row.lastError = null
    await this.dispatches.save(row)
  }

  async cancelDispatch(tenantId: number, dispatchId: string): Promise<void> {
    const row = await this.dispatches.findOne({ where: { tenantId, dispatchId } })
    if (!row || ['COMPLETED', 'FAILED', 'CANCELLED'].includes(row.status)) return
    row.status = 'CANCELLED'
    row.completedAt = new Date()
    row.lastError = null
    await this.dispatches.save(row)
  }

  private async ensureDispatch(enrollment: AutomationSequenceEnrollmentEntity, step: AutomationSequenceStepEntity, runAt: Date) {
    const idempotencyKey = `${enrollment.enrollmentId}:${step.externalId}:${step.order}`
    const existing = await this.dispatches.findOne({ where: { tenantId: enrollment.tenantId, idempotencyKey } })
    if (existing) return existing
    try {
      return await this.dispatches.save(this.dispatches.create({
        tenantId: enrollment.tenantId,
        dispatchId: randomUUID(),
        idempotencyKey,
        enrollmentId: enrollment.enrollmentId,
        sequenceExternalId: enrollment.sequenceExternalId,
        stepExternalId: step.externalId,
        runAt,
        status: 'PENDING',
        attempts: 0,
        flowExecutionId: null,
        lastError: null,
        completedAt: null,
      }))
    } catch (error) {
      const raced = await this.dispatches.findOne({ where: { tenantId: enrollment.tenantId, idempotencyKey } })
      if (raced) return raced
      throw error
    }
  }

  private async findConversation(tenantId: number, conversationId: string): Promise<{ contactIdentityId: number | null }> {
    const rows = await this.dataSource.query(
      `SELECT "contact_identity_id" FROM "cc_conversation_link" WHERE "tenant_id" = $1 AND "libredesk_conversation_uuid"::text = $2 LIMIT 1`,
      [tenantId, conversationId],
    )
    if (!rows?.length) throw new BadRequestException('conversation_id does not belong to this tenant')
    return { contactIdentityId: rows[0].contact_identity_id == null ? null : Number(rows[0].contact_identity_id) }
  }

  private async requireSequence(tenantId: number, externalId: string) {
    const row = await this.sequences.findOne({ where: { tenantId, externalId, isDelete: false } })
    if (!row) throw new NotFoundException('Automation sequence not found')
    return row
  }

  private async requireFlow(tenantId: number, externalId: string) {
    const row = await this.flows.findOne({ where: { tenantId, externalId, isDelete: false } })
    if (!row) throw new BadRequestException('flow_id does not belong to this tenant')
    return row
  }

  private async mapSequence(row: AutomationSequenceEntity) {
    const steps = await this.steps.find({ where: { tenantId: row.tenantId, sequenceExternalId: row.externalId }, order: { order: 'ASC' } })
    return {
      _id: row.externalId,
      name: row.name,
      status: row.status,
      active: row.active,
      timezone: row.timezone,
      config: row.config,
      steps: steps.map((step) => this.mapStep(step)),
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private mapStep(row: AutomationSequenceStepEntity) {
    return {
      _id: row.externalId,
      sequence_id: row.sequenceExternalId,
      flow_id: row.flowExternalId,
      order: row.order,
      delay_days: row.delayDays,
      delay_minutes: row.delayMinutes,
      specific_date_time: row.specificDateTime,
      is_active: row.isActive,
      anytime: row.anytime,
      send_time_start: row.sendTimeStart,
      send_time_end: row.sendTimeEnd,
      send_days: row.sendDays,
    }
  }

  private mapEnrollment(row: AutomationSequenceEnrollmentEntity) {
    return {
      enrollment_id: row.enrollmentId,
      sequence_id: row.sequenceExternalId,
      contact_identity_id: row.contactIdentityId,
      conversation_id: row.conversationId,
      status: row.status,
      current_order: row.currentOrder,
      last_step_id: row.lastStepId,
      next_step_id: row.nextStepId,
      next_run_at: row.nextRunAt,
      enrolled_at: row.enrolledAt,
      completed_at: row.completedAt,
      last_error: row.lastError,
    }
  }

  private requireTenant(ctx: LadiflowRpcContext): number {
    const tenantId = Number(ctx.tenantId)
    if (!Number.isInteger(tenantId) || tenantId <= 0) throw new BadRequestException('x-tenant-id is required for automation writes')
    return tenantId
  }

  private newExternalId(): string {
    return randomBytes(12).toString('hex')
  }

  private requiredString(value: unknown, name: string): string {
    const text = String(value ?? '').trim()
    if (!text) throw new BadRequestException(`${name} is required`)
    return text
  }

  private stringOr(value: unknown, fallback: string): string {
    const text = String(value ?? '').trim()
    return text || fallback
  }

  private nonNegativeInt(value: unknown, fallback: number): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback
  }

  private positiveInt(value: unknown, fallback: number): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback
  }

  private optionalDate(value: unknown): Date | null {
    if (!value) return null
    const date = new Date(String(value))
    if (Number.isNaN(date.getTime())) throw new BadRequestException('specific_date_time is invalid')
    return date
  }

  private optionalTime(value: unknown): string | null {
    const text = String(value ?? '').trim()
    if (!text) return null
    if (!/^\d{2}:\d{2}$/.test(text)) throw new BadRequestException('send time must use HH:mm')
    const [hour, minute] = text.split(':').map(Number)
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new BadRequestException('send time is outside the valid HH:mm range')
    }
    return text
  }

  private sendDays(value: unknown): string[] {
    const allowed = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    const rows = Array.isArray(value) ? value.map((item) => String(item).toLowerCase()).filter((item) => allowed.has(item)) : []
    return rows.length ? [...new Set(rows)] : [...allowed]
  }

  private validTimezone(value: string): string {
    const timezone = value.trim() || 'UTC'
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
      return timezone
    } catch {
      throw new BadRequestException('timezone is invalid')
    }
  }

  private record(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
  }
}
