import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import type { AdsProvider } from '@liora/ads-contracts'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { AdsAuditService } from '../core/ads-audit.service'
import { AdsAccountEntity } from '../entities'
import { AdsOperationContextFactory } from '../core/ads-operation-context.factory'
import { AdsProviderRegistry } from '../core/ads-provider-registry.service'
import { AdsSnapshotService } from './ads-snapshot.service'

@Injectable()
export class AdsBrowserSnapshotService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(AdsAccountEntity)
    private readonly accounts: Repository<AdsAccountEntity>,
    private readonly registry: AdsProviderRegistry,
    private readonly contextFactory: AdsOperationContextFactory,
    private readonly snapshots: AdsSnapshotService,
    private readonly audit: AdsAuditService,
  ) {
    super(tenantContext)
  }

  async ingest(
    input: {
      provider: AdsProvider
      connectionId?: string
      externalAccountId: string
      observedAt: string
      schemaVersion: number
      payload: Record<string, unknown>
    },
    actorId: string,
  ) {
    const plugin = this.registry.requireCapability(input.provider, 'BROWSER_SNAPSHOT')
    if (!plugin.browserSnapshot) {
      throw new NotFoundException(`${input.provider} browser snapshot adapter is not implemented`)
    }
    const tenantId = this.requireTenantId()
    const account = await this.accounts.findOneBy({
      tenantId,
      provider: input.provider,
      externalId: input.externalAccountId,
      ...(input.connectionId ? { connectionId: input.connectionId } : {}),
    })
    if (!account) throw new NotFoundException('Ads account was not found for this extension session')
    const context = this.contextFactory.create({
      tenantId,
      actorId,
      provider: input.provider,
      providerVersion: plugin.manifest.version,
      source: 'BROWSER_EXTENSION',
      connectionId: account.connectionId,
      externalAccountId: input.externalAccountId,
    })
    const snapshot = await plugin.browserSnapshot.normalize(
      {
        externalAccountId: input.externalAccountId,
        observedAt: input.observedAt,
        schemaVersion: input.schemaVersion,
        payload: input.payload,
      },
      context,
    )
    const inserted = await this.snapshots.persist(snapshot)
    await this.audit.record(context, 'ADS.EXTENSION.SNAPSHOT_ACCEPTED', 'SUCCEEDED', {
      targetType: 'ADS_ACCOUNT',
      targetId: input.externalAccountId,
      metadata: { inserted, fingerprint: snapshot.fingerprint, confidence: snapshot.confidence },
    })
    return { inserted, fingerprint: snapshot.fingerprint, confidence: snapshot.confidence }
  }
}
