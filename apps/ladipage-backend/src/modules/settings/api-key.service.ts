import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { randomBytes, randomUUID, createHash } from 'crypto'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { Tenant, TenantContextService } from '@liora/nest-core'

import { TenantScopedService } from '../../common/services/tenant-scoped.service'
import {
  type ApiKeyListItemDto,
  type CreatedApiKeyDto,
  type CreateApiKeyDto,
  MCP_API_KEY_SCOPES,
  type McpApiKeyScope,
} from './dto/api-key.dto'
import { ApiKeyEntity } from './entities'

export interface ValidatedApiKeyContext {
  apiKeyId: number
  tenantId: number
  organizationId: string
  ownerId: string
  scopes: McpApiKeyScope[]
}

@Injectable()
export class ApiKeyService extends TenantScopedService {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepository: Repository<ApiKeyEntity>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    tenantContext: TenantContextService,
  ) {
    super(tenantContext)
  }

  async listApiKeys(): Promise<ApiKeyListItemDto[]> {
    const tenantId = this.requireTenantId()
    const keys = await this.apiKeyRepository.find({
      where: { tenantId, isDelete: false },
      order: { createdAt: 'DESC' },
    })
    return keys.map((key) => this.mapListItem(key))
  }

  async createApiKey(dto: CreateApiKeyDto, ownerId: number): Promise<CreatedApiKeyDto> {
    const tenantId = this.requireTenantId()
    const rawKey = this.generateRawKey()
    const entity = this.apiKeyRepository.create({
      tenantId,
      externalId: randomUUID(),
      ownerId: String(ownerId),
      ladiUid: null,
      name: dto.name.trim(),
      keyPrefix: this.keyPrefix(rawKey),
      keyHash: this.hashKey(rawKey),
      scopes: { items: this.normalizeScopes(dto.scopes) },
      status: 'active',
      isDefault: false,
      isDelete: false,
      lastUsedAt: null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      revokedAt: null,
      metadata: { source: 'settings-api' },
    })

    if (!entity.name) {
      throw new BadRequestException('API key name is required')
    }

    const saved = await this.apiKeyRepository.save(entity)
    return {
      ...this.mapListItem(saved),
      key: rawKey,
    }
  }

  async revokeApiKey(id: number): Promise<ApiKeyListItemDto> {
    const key = await this.findApiKeyForTenant(id)
    if (key.status === 'revoked') {
      return this.mapListItem(key)
    }

    key.status = 'revoked'
    key.revokedAt = new Date()
    const saved = await this.apiKeyRepository.save(key)
    return this.mapListItem(saved)
  }

  async rotateApiKey(id: number): Promise<CreatedApiKeyDto> {
    const key = await this.findApiKeyForTenant(id)
    if (key.status !== 'active') {
      throw new BadRequestException('Only active API keys can be rotated')
    }

    const rawKey = this.generateRawKey()
    key.keyPrefix = this.keyPrefix(rawKey)
    key.keyHash = this.hashKey(rawKey)
    key.metadata = {
      ...key.metadata,
      rotatedAt: new Date().toISOString(),
    }

    const saved = await this.apiKeyRepository.save(key)
    return {
      ...this.mapListItem(saved),
      key: rawKey,
    }
  }

  async validateRawKey(rawKey: string): Promise<ValidatedApiKeyContext> {
    const keyHash = this.hashKey(rawKey)
    const entity = await this.apiKeyRepository.findOne({
      where: { keyHash, status: 'active', isDelete: false },
    })

    if (!entity) {
      throw new UnauthorizedException('Invalid API key')
    }
    if (entity.expiresAt && entity.expiresAt.getTime() <= Date.now()) {
      entity.status = 'expired'
      await this.apiKeyRepository.save(entity)
      throw new UnauthorizedException('API key expired')
    }

    const tenant = await this.tenantRepository.findOne({ where: { id: entity.tenantId } })
    if (!tenant?.organizationId) {
      throw new UnauthorizedException('API key tenant is not linked to an organization')
    }

    entity.lastUsedAt = new Date()
    await this.apiKeyRepository.save(entity)

    return {
      apiKeyId: entity.id,
      tenantId: entity.tenantId,
      organizationId: tenant.organizationId,
      ownerId: entity.ownerId,
      scopes: this.normalizeScopes(entity.scopes),
    }
  }

  hasScopes(actualScopes: McpApiKeyScope[], requiredScopes: McpApiKeyScope[]): boolean {
    return requiredScopes.every((scope) => actualScopes.includes(scope))
  }

  private async findApiKeyForTenant(id: number): Promise<ApiKeyEntity> {
    const tenantId = this.requireTenantId()
    const entity = await this.apiKeyRepository.findOne({
      where: { id, tenantId, isDelete: false },
    })
    if (!entity) {
      throw new NotFoundException('API key not found')
    }
    return entity
  }

  private normalizeScopes(scopes: unknown): McpApiKeyScope[] {
    const values = Array.isArray(scopes)
      ? scopes
      : typeof scopes === 'object' && scopes !== null && Array.isArray((scopes as { items?: unknown }).items)
        ? (scopes as { items: unknown[] }).items
        : []

    const allowed = new Set<string>(MCP_API_KEY_SCOPES)
    const normalized = values.filter((scope): scope is McpApiKeyScope => (
      typeof scope === 'string' && allowed.has(scope)
    ))

    return normalized.length
      ? Array.from(new Set(normalized))
      : ['workspace:read', 'landing:read']
  }

  private mapListItem(entity: ApiKeyEntity): ApiKeyListItemDto {
    return {
      id: entity.id,
      name: entity.name,
      keyPrefix: entity.keyPrefix,
      scopes: this.normalizeScopes(entity.scopes),
      status: entity.status,
      isDefault: entity.isDefault,
      lastUsedAt: entity.lastUsedAt?.toISOString() ?? null,
      expiresAt: entity.expiresAt?.toISOString() ?? null,
      createdAt: entity.createdAt.toISOString(),
    }
  }

  private generateRawKey(): string {
    return `lp_${randomBytes(32).toString('base64url')}`
  }

  private keyPrefix(rawKey: string): string {
    return `${rawKey.slice(0, 10)}...`
  }

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex')
  }
}
