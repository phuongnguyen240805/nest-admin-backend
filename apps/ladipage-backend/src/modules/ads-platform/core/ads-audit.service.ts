import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import type { AdsOperationContext } from '@liora/ads-contracts'

import { AdsAuditEventEntity } from '../entities'
import { AdsRedactionService } from './ads-redaction.service'

@Injectable()
export class AdsAuditService {
  private readonly logger = new Logger(AdsAuditService.name)

  constructor(
    @InjectRepository(AdsAuditEventEntity)
    private readonly auditRepository: Repository<AdsAuditEventEntity>,
    private readonly redaction: AdsRedactionService,
  ) {}

  async record(
    context: AdsOperationContext,
    eventCode: string,
    outcome: AdsAuditEventEntity['outcome'],
    details: {
      targetType?: string
      targetId?: string
      metadata?: Record<string, unknown>
    } = {},
  ): Promise<void> {
    const metadata = this.redaction.redact(details.metadata ?? {})
    await this.auditRepository.save({
      tenantId: context.tenantId,
      operationId: context.operationId,
      traceId: context.traceId,
      actorId: context.actorId,
      provider: context.provider,
      eventCode,
      outcome,
      targetType: details.targetType ?? null,
      targetId: details.targetId ?? null,
      metadata,
    })
    this.logger.log(
      JSON.stringify({
        eventCode,
        outcome,
        operationId: context.operationId,
        traceId: context.traceId,
        tenantId: context.tenantId,
        provider: context.provider,
        ...metadata,
      }),
    )
  }
}
