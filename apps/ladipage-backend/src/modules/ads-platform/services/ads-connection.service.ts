import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import type { AdsOperationContext, AdsProvider } from '@liora/ads-contracts'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { AdsAuditService } from '../core/ads-audit.service'
import { AdsOAuthStateService } from '../core/ads-oauth-state.service'
import { AdsOperationContextFactory } from '../core/ads-operation-context.factory'
import { AdsProviderRegistry } from '../core/ads-provider-registry.service'
import { AdsVaultService } from '../core/ads-vault.service'
import { AdsAccountEntity, AdsConnectionEntity } from '../entities'

@Injectable()
export class AdsConnectionService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(AdsConnectionEntity)
    private readonly connectionRepository: Repository<AdsConnectionEntity>,
    @InjectRepository(AdsAccountEntity)
    private readonly accountRepository: Repository<AdsAccountEntity>,
    private readonly registry: AdsProviderRegistry,
    private readonly oauthState: AdsOAuthStateService,
    private readonly vault: AdsVaultService,
    private readonly contextFactory: AdsOperationContextFactory,
    private readonly audit: AdsAuditService,
  ) {
    super(tenantContext)
  }

  listConnections() {
    return this.connectionRepository.find({
      where: this.tenantWhere<AdsConnectionEntity>(),
      order: { updatedAt: 'DESC' },
      select: {
        id: true,
        tenantId: true,
        provider: true,
        externalUserId: true,
        displayName: true,
        status: true,
        scopes: true,
        tokenExpiresAt: true,
        lastSyncedAt: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async startOAuth(provider: AdsProvider, actorId: string, returnTo?: string) {
    const plugin = this.registry.requireCapability(provider, 'CONNECTION')
    if (!plugin.connection) throw new NotFoundException(`${provider} OAuth is not implemented`)
    const tenantId = this.requireTenantId()
    const state = await this.oauthState.issue({ tenantId, actorId, provider, returnTo })
    const context = this.contextFactory.create({
      tenantId,
      actorId,
      provider,
      providerVersion: plugin.manifest.version,
    })
    const url = await plugin.connection.getAuthorizationUrl(context, state, returnTo)
    await this.audit.record(context, 'ADS.CONNECTION.STARTED', 'STARTED')
    return { provider, url, expiresInSeconds: 600 }
  }

  async completeOAuth(provider: AdsProvider, code: string, state: string) {
    const plugin = this.registry.requireCapability(provider, 'CONNECTION')
    if (!plugin.connection) throw new NotFoundException(`${provider} OAuth is not implemented`)
    const stateRecord = await this.oauthState.consume(state, provider)
    const context = this.contextFactory.create({
      tenantId: stateRecord.tenantId,
      actorId: stateRecord.actorId,
      provider,
      providerVersion: plugin.manifest.version,
      source: 'OAUTH_CALLBACK',
    })

    try {
      const exchanged = await plugin.connection.exchangeAuthorizationCode(code, context)
      let connection = await this.connectionRepository.findOneBy({
        tenantId: stateRecord.tenantId,
        provider,
        externalUserId: exchanged.externalUserId,
      })
      connection ??= this.connectionRepository.create({
        tenantId: stateRecord.tenantId,
        provider,
        externalUserId: exchanged.externalUserId,
      })
      Object.assign(connection, {
        status: 'CONNECTED',
        scopes: exchanged.scopes,
        tokenExpiresAt: exchanged.expiresAt ? new Date(exchanged.expiresAt) : null,
        metadata: { connectedBy: stateRecord.actorId },
      })
      connection = await this.connectionRepository.save(connection)
      await this.vault.store(connection.id, exchanged.credential)
      context.connectionId = connection.id
      await this.audit.record(context, 'ADS.CONNECTION.SUCCEEDED', 'SUCCEEDED', {
        targetType: 'CONNECTION',
        targetId: connection.id,
        metadata: { scopes: exchanged.scopes, expiresAt: exchanged.expiresAt ?? null },
      })
      return { connectionId: connection.id, provider, status: connection.status, returnTo: stateRecord.returnTo }
    } catch (error) {
      await this.audit.record(context, 'ADS.CONNECTION.FAILED', 'FAILED', {
        metadata: { message: error instanceof Error ? error.message : String(error) },
      })
      throw error
    }
  }

  async disconnect(connectionId: string, actorId: string) {
    const connection = await this.findOneForTenantOrFail(
      this.connectionRepository,
      { id: connectionId },
      'Ads connection was not found',
    )
    connection.status = 'DISCONNECTED'
    await this.connectionRepository.save(connection)
    await this.vault.remove(connection.id)
    const context = this.createContext(connection, actorId)
    await this.audit.record(context, 'ADS.CONNECTION.DISCONNECTED', 'SUCCEEDED', {
      targetType: 'CONNECTION',
      targetId: connection.id,
    })
    return { connectionId, status: connection.status }
  }

  async discoverAccounts(connectionId: string, actorId: string) {
    const connection = await this.findOneForTenantOrFail(
      this.connectionRepository,
      { id: connectionId, status: 'CONNECTED' },
      'Active ads connection was not found',
    )
    const plugin = this.registry.requireCapability(connection.provider, 'ACCOUNT_DISCOVERY')
    if (!plugin.discovery) throw new NotFoundException(`${connection.provider} discovery is not implemented`)
    const context = this.createContext(connection, actorId)
    const accounts = await plugin.discovery.discoverAccounts(context)
    for (const account of accounts) {
      await this.accountRepository.upsert(
        {
          tenantId: connection.tenantId,
          connectionId: connection.id,
          provider: connection.provider,
          externalId: account.externalId,
          name: account.name,
          currency: account.currency ?? null,
          timezone: account.timezone ?? null,
          status: account.status ?? null,
          metadata: account.metadata ?? {},
        },
        ['tenantId', 'provider', 'externalId'],
      )
    }
    await this.audit.record(context, 'ADS.ACCOUNTS.DISCOVERED', 'SUCCEEDED', {
      targetType: 'CONNECTION',
      targetId: connection.id,
      metadata: { count: accounts.length },
    })
    return this.listAccounts(connectionId)
  }

  listAccounts(connectionId?: string) {
    return this.accountRepository.find({
      where: this.tenantWhere<AdsAccountEntity>(connectionId ? { connectionId } : {}),
      order: { provider: 'ASC', name: 'ASC' },
    })
  }

  private createContext(connection: AdsConnectionEntity, actorId: string): AdsOperationContext {
    return this.contextFactory.create({
      tenantId: connection.tenantId,
      actorId,
      provider: connection.provider,
      providerVersion: this.registry.get(connection.provider).manifest.version,
      connectionId: connection.id,
    })
  }
}
