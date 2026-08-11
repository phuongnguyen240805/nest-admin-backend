import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { createHash } from 'node:crypto'
import { DataSource, Repository } from 'typeorm'

import { TenantContextService } from '@liora/nest-core'

import { DomainEventOutboxService } from '../../domain-events/domain-event-outbox.service'
import { OrderLifecycleService } from '../../ecom-store/services/order-lifecycle.service'
import { CustomerCareAiActionRequestEntity } from '../entities'
import { CustomerCareAiActionPolicyService } from './customer-care-ai-action-policy.service'

export interface ModelActionProposal {
  actionType?: unknown
  arguments?: unknown
  reason?: unknown
}

@Injectable()
export class CustomerCareAiActionService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly policy: CustomerCareAiActionPolicyService,
    private readonly lifecycle: OrderLifecycleService,
    private readonly domainEvents: DomainEventOutboxService,
    private readonly dataSource: DataSource,
    @InjectRepository(CustomerCareAiActionRequestEntity)
    private readonly actions: Repository<CustomerCareAiActionRequestEntity>,
  ) {}

  async proposeFromModel(input: {
    conversationId: string
    jobId: string
    model?: string | null
    proposals: ModelActionProposal[]
  }) {
    const tenantId = this.requireTenantId()
    const created: CustomerCareAiActionRequestEntity[] = []
    for (const proposal of input.proposals.slice(0, 3)) {
      const actionType = String(proposal?.actionType ?? '').trim().toUpperCase()
      const args = proposal?.arguments && typeof proposal.arguments === 'object' && !Array.isArray(proposal.arguments)
        ? proposal.arguments as Record<string, unknown>
        : {}
      if (!actionType) continue
      const policyResult = await this.policy.evaluate(input.conversationId, actionType, args)
      const idempotencyKey = createHash('sha256')
        .update(`${input.jobId}:${actionType}:${JSON.stringify(args)}`)
        .digest('hex')
        .slice(0, 80)
      const existing = await this.actions.findOne({ where: { tenantId, idempotencyKey } })
      if (existing) {
        created.push(existing)
        continue
      }
      const row = await this.actions.save(this.actions.create({
        tenantId,
        conversationId: input.conversationId,
        jobId: input.jobId,
        actionType,
        arguments: args,
        riskLevel: policyResult.riskLevel,
        policyResult: { ...policyResult, modelReason: proposal.reason ? String(proposal.reason).slice(0, 500) : null },
        status: policyResult.allowedToPropose ? 'proposed' : 'blocked',
        proposedByModel: input.model ?? null,
        approvedBy: null,
        approvedAt: null,
        executedAt: null,
        executionResult: null,
        idempotencyKey,
      }))
      await this.domainEvents.append({
        tenantId,
        aggregateType: 'conversation',
        aggregateId: input.conversationId,
        eventType: policyResult.allowedToPropose ? 'ai.action.proposed' : 'ai.action.blocked',
        payload: { conversationId: input.conversationId, actionId: row.id, actionType, policyResult },
      })
      created.push(row)
    }
    return created.map((row) => this.toPublic(row))
  }

  async list(conversationId: string) {
    const tenantId = this.requireTenantId()
    const rows = await this.actions.find({ where: { tenantId, conversationId }, order: { createdAt: 'DESC' }, take: 50 })
    return rows.map((row) => this.toPublic(row))
  }

  async approve(actionId: string, actorUserId: number, reason?: string) {
    const tenantId = this.requireTenantId()
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CustomerCareAiActionRequestEntity)
      const row = await repo.createQueryBuilder('action')
        .setLock('pessimistic_write')
        .where('action.id = :id AND action.tenantId = :tenantId', { id: actionId, tenantId })
        .getOne()
      if (!row) throw new NotFoundException('AI action not found')
      if (row.status === 'executed') return this.toPublic(row)
      if (row.status !== 'proposed') throw new BadRequestException(`AI action cannot be approved from status ${row.status}`)

      const policyResult = await this.policy.evaluate(row.conversationId, row.actionType, row.arguments)
      row.policyResult = { ...policyResult, approvalReason: reason?.trim() || null }
      if (!policyResult.allowedToPropose || !policyResult.executable) {
        throw new BadRequestException(policyResult.reason || 'AI action is not executable')
      }

      row.approvedBy = actorUserId > 0 ? actorUserId : null
      row.approvedAt = new Date()
      row.status = 'approved'
      await repo.save(row)

      if (row.actionType !== 'PROPOSE_CANCEL_ORDER' || !policyResult.orderId) {
        throw new BadRequestException('No executable application handler for this action')
      }

      const order = await this.lifecycle.cancel(
        policyResult.orderId,
        reason?.trim() || String(row.arguments.reason ?? 'Cancelled after AI proposal approval'),
        manager,
      )
      row.status = 'executed'
      row.executedAt = new Date()
      row.executionResult = {
        orderId: order.id,
        orderCode: order.code,
        businessStatus: order.businessStatus,
        paymentStatus: order.paymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        requiresRefundReview: policyResult.requiresRefundReview === true,
      }
      const saved = await repo.save(row)
      await this.domainEvents.append({
        tenantId,
        aggregateType: 'conversation',
        aggregateId: row.conversationId,
        eventType: 'ai.action.executed',
        payload: { conversationId: row.conversationId, actionId: row.id, actionType: row.actionType, executionResult: row.executionResult },
      }, manager)
      return this.toPublic(saved)
    })
  }

  async reject(actionId: string, actorUserId: number, reason?: string) {
    const tenantId = this.requireTenantId()
    const row = await this.actions.findOne({ where: { id: actionId, tenantId } })
    if (!row) throw new NotFoundException('AI action not found')
    if (row.status === 'executed') throw new BadRequestException('Executed AI action cannot be rejected')
    if (row.status === 'rejected') return this.toPublic(row)
    if (!['proposed', 'blocked'].includes(row.status)) throw new BadRequestException(`AI action cannot be rejected from status ${row.status}`)
    row.status = 'rejected'
    row.policyResult = { ...(row.policyResult ?? {}), rejectionReason: reason?.trim() || null, rejectedBy: actorUserId > 0 ? actorUserId : null }
    const saved = await this.actions.save(row)
    await this.domainEvents.append({
      tenantId,
      aggregateType: 'conversation',
      aggregateId: row.conversationId,
      eventType: 'ai.action.rejected',
      payload: { conversationId: row.conversationId, actionId: row.id, actionType: row.actionType },
    })
    return this.toPublic(saved)
  }

  private toPublic(row: CustomerCareAiActionRequestEntity) {
    return {
      id: row.id,
      conversationId: row.conversationId,
      jobId: row.jobId,
      actionType: row.actionType,
      arguments: row.arguments,
      riskLevel: row.riskLevel,
      policyResult: row.policyResult,
      status: row.status,
      proposedByModel: row.proposedByModel,
      approvedBy: row.approvedBy,
      approvedAt: row.approvedAt,
      executedAt: row.executedAt,
      executionResult: row.executionResult,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  private requireTenantId() {
    const tenantId = this.tenantContext.getTenantId()
    if (tenantId == null) throw new ForbiddenException('Tenant ID is required')
    return tenantId
  }
}
