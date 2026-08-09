import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { TenantContextService } from '@liora/nest-core'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { SaveShippingIntegrationDto } from '../dto/shipping.dto'
import {
  ShippingIntegrationEntity,
  ShippingProvider,
} from '../entities'
import { GhnShippingAdapter } from './ghn.adapter'
import { GhtkShippingAdapter } from './ghtk.adapter'
import { ShippingAdapter } from './shipping-adapter'
import { ShippingCredentialVaultService } from './shipping-credential-vault.service'

const PROVIDER_NAMES: Record<ShippingProvider, string> = {
  ghn: 'Giao Hàng Nhanh',
  ghtk: 'Giao Hàng Tiết Kiệm',
}

@Injectable()
export class ShippingIntegrationService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(ShippingIntegrationEntity)
    private readonly repository: Repository<ShippingIntegrationEntity>,
    private readonly vault: ShippingCredentialVaultService,
  ) {
    super(tenantContext)
  }

  async list() {
    const rows = await this.repository.find({
      where: { tenantId: this.requireTenantId() },
      order: { provider: 'ASC' },
    })
    return (['ghn', 'ghtk'] as ShippingProvider[]).map((provider) => {
      const row = rows.find((item) => item.provider === provider)
      return {
        id: row?.id,
        provider,
        name: PROVIDER_NAMES[provider],
        enabled: row?.enabled ?? false,
        configured: Boolean(row?.ciphertext),
        connectedAt: row?.connectedAt,
        settings: row?.settings ?? {},
        credentials: {
          token: row?.ciphertext ? '••••' : '',
          ...(provider === 'ghn'
            ? { shopId: row?.ciphertext ? '••••' : '' }
            : {}),
        },
      }
    })
  }

  async save(provider: ShippingProvider, dto: SaveShippingIntegrationDto) {
    const tenantId = this.requireTenantId()
    let row = await this.repository.findOne({ where: { tenantId, provider } })
    const previous = row ? this.decrypt(row) : {}
    const credentials = {
      ...previous,
      ...(dto.token?.trim() && dto.token !== '••••'
        ? { token: dto.token.trim() }
        : {}),
      ...(dto.shopId?.trim() && dto.shopId !== '••••'
        ? { shopId: dto.shopId.trim() }
        : {}),
    }
    if (!credentials.token) throw new BadRequestException('Token is required')
    if (provider === 'ghn' && !credentials.shopId) {
      throw new BadRequestException('GHN shopId is required')
    }
    const encrypted = this.vault.encrypt(
      this.scope(tenantId, provider),
      credentials,
    )
    row = this.repository.create({
      ...(row ?? {}),
      tenantId,
      provider,
      name: PROVIDER_NAMES[provider],
      enabled: dto.enabled ?? row?.enabled ?? true,
      settings: { ...(row?.settings ?? {}), ...(dto.settings ?? {}) },
      ...encrypted,
    })
    await this.repository.save(row)
    return (await this.list()).find((item) => item.provider === provider)
  }

  async test(provider: ShippingProvider) {
    const adapter = await this.getAdapter(provider, false)
    const result = await adapter.testConnection()
    if (result.success) {
      const tenantId = this.requireTenantId()
      await this.repository.update(
        { tenantId, provider },
        { connectedAt: new Date(), enabled: true },
      )
    }
    return result
  }

  async execute(
    provider: ShippingProvider,
    action: string,
    params: Record<string, unknown>,
  ) {
    return (await this.getAdapter(provider)).execute(action, params)
  }

  private async getAdapter(provider: ShippingProvider, requireEnabled = true) {
    const tenantId = this.requireTenantId()
    const row = await this.repository.findOne({ where: { tenantId, provider } })
    if (!row) throw new NotFoundException(`${PROVIDER_NAMES[provider]} chưa được cấu hình`)
    if (requireEnabled && !row.enabled) {
      throw new BadRequestException(`${PROVIDER_NAMES[provider]} đang tắt`)
    }
    const config = {
      id: row.id,
      provider,
      enabled: row.enabled,
      credentials: this.decrypt(row),
      settings: row.settings ?? {},
    }
    return provider === 'ghn'
      ? new GhnShippingAdapter(config)
      : new GhtkShippingAdapter(config)
  }

  private decrypt(row: ShippingIntegrationEntity) {
    return this.vault.decrypt(this.scope(row.tenantId, row.provider), row)
  }

  private scope(tenantId: number, provider: ShippingProvider) {
    return `shipping:${tenantId}:${provider}`
  }
}
