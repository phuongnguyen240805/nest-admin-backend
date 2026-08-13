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
import {
  isShippingProvider,
  SHIPPING_PROVIDER_NAMES,
} from './core'
import { ShippingAdapterRegistry } from './shipping-adapter.registry'
import { ShippingCredentialVaultService } from './shipping-credential-vault.service'

@Injectable()
export class ShippingIntegrationService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(ShippingIntegrationEntity)
    private readonly repository: Repository<ShippingIntegrationEntity>,
    private readonly vault: ShippingCredentialVaultService,
    private readonly registry: ShippingAdapterRegistry,
  ) {
    super(tenantContext)
  }

  async list() {
    const rows = await this.repository.find({
      where: { tenantId: this.requireTenantId() },
      order: { provider: 'ASC' },
    })
    return this.registry.registeredProviders().map((provider) => {
      const row = rows.find((item) => item.provider === provider)
      const capabilities = this.registry.create({
        id: row?.id ?? 0,
        provider,
        enabled: row?.enabled ?? false,
        credentials: {},
        settings: row?.settings ?? {},
      }).getCapabilities()
      return {
        id: row?.id,
        provider,
        name: SHIPPING_PROVIDER_NAMES[provider],
        capabilities,
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
    this.requireRegisteredProvider(provider)
    this.validateSettings(dto.settings)
    const tenantId = this.requireTenantId()
    let row = await this.repository.findOne({ where: { tenantId, provider } })
    const previous = row ? this.decrypt(row) : {}
    const credentials: Record<string, string> = {
      ...previous,
      ...(dto.token?.trim() && dto.token !== '••••'
        ? { token: dto.token.trim() }
        : {}),
      ...(dto.shopId?.trim() && dto.shopId !== '••••'
        ? { shopId: dto.shopId.trim() }
        : {}),
      ...this.credentialPatch(dto, 'apiAccount'),
      ...this.credentialPatch(dto, 'customerCode'),
      ...this.credentialPatch(dto, 'privateKey'),
      ...this.credentialPatch(dto, 'username'),
      ...this.credentialPatch(dto, 'password'),
    }
    if (!credentials.token && !credentials.apiAccount && !credentials.username) {
      throw new BadRequestException('Provider credentials are required')
    }
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
      name: SHIPPING_PROVIDER_NAMES[provider],
      enabled: dto.enabled ?? row?.enabled ?? true,
      settings: { ...(row?.settings ?? {}), ...(dto.settings ?? {}) },
      ...encrypted,
    })
    await this.repository.save(row)
    return (await this.list()).find((item) => item.provider === provider)
  }

  async test(provider: ShippingProvider) {
    this.requireRegisteredProvider(provider)
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
    this.requireRegisteredProvider(provider)
    return (await this.getAdapter(provider)).execute(action, params)
  }

  private async getAdapter(provider: ShippingProvider, requireEnabled = true) {
    const tenantId = this.requireTenantId()
    const row = await this.repository.findOne({ where: { tenantId, provider } })
    if (!row) throw new NotFoundException(`${SHIPPING_PROVIDER_NAMES[provider]} chưa được cấu hình`)
    if (requireEnabled && !row.enabled) {
      throw new BadRequestException(`${SHIPPING_PROVIDER_NAMES[provider]} đang tắt`)
    }
    const config = {
      id: row.id,
      provider,
      enabled: row.enabled,
      credentials: this.decrypt(row),
      settings: row.settings ?? {},
    }
    return this.registry.create(config)
  }

  private decrypt(row: ShippingIntegrationEntity) {
    return this.vault.decrypt(this.scope(row.tenantId, row.provider), row)
  }

  private scope(tenantId: number, provider: ShippingProvider) {
    return `shipping:${tenantId}:${provider}`
  }

  private requireRegisteredProvider(provider: ShippingProvider) {
    if (!isShippingProvider(provider) || !this.registry.isRegistered(provider)) {
      throw new BadRequestException(
        `Nhà vận chuyển ${String(provider)} chưa có adapter production`,
      )
    }
  }

  private credentialPatch(
    dto: SaveShippingIntegrationDto,
    key: 'apiAccount' | 'customerCode' | 'privateKey' | 'username' | 'password',
  ) {
    const value = dto[key]?.trim()
    return value && value !== '••••' ? { [key]: value } : {}
  }

  private validateSettings(settings?: Record<string, unknown>) {
    if (!settings) return
    if (settings.baseUrl) {
      let url: URL
      try {
        url = new URL(String(settings.baseUrl))
      } catch {
        throw new BadRequestException('Shipping baseUrl is invalid')
      }
      const host = url.hostname.toLowerCase()
      const privateHost = host === 'localhost'
        || host === '127.0.0.1'
        || host === '::1'
        || host.startsWith('10.')
        || host.startsWith('192.168.')
        || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
      if (url.protocol !== 'https:' || privateHost) {
        throw new BadRequestException('Shipping baseUrl must be a public HTTPS URL')
      }
    }
    const endpoints = settings.endpoints as Record<string, unknown> | undefined
    for (const value of Object.values(endpoints ?? {})) {
      if (value && !String(value).startsWith('/')) {
        throw new BadRequestException('Shipping endpoints must be relative paths')
      }
    }
  }
}
