import { randomUUID } from 'node:crypto'

import { Injectable } from '@nestjs/common'

import type { AdsOperationContext, AdsProvider } from '@liora/ads-contracts'

@Injectable()
export class AdsOperationContextFactory {
  create(input: {
    tenantId: number
    actorId: string
    provider: AdsProvider
    providerVersion: string
    source?: string
    connectionId?: string
    externalAccountId?: string
    jobId?: string
    traceId?: string
  }): AdsOperationContext {
    return {
      operationId: randomUUID(),
      traceId: input.traceId ?? randomUUID(),
      tenantId: input.tenantId,
      actorId: input.actorId,
      provider: input.provider,
      source: input.source ?? 'LADIPAGE_API',
      policyVersion: 'ads-policy-v1',
      providerVersion: input.providerVersion,
      connectionId: input.connectionId,
      externalAccountId: input.externalAccountId,
      jobId: input.jobId,
    }
  }
}
