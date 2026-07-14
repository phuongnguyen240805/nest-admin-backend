import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

export type ApiKeyStatus = 'active' | 'revoked' | 'expired'

@Entity('lp_api_key')
@Index(['tenantId', 'keyHash'], { unique: true })
@Index(['tenantId', 'ownerId'])
@Index(['tenantId', 'status'])
export class ApiKeyEntity extends TenantScopedEntity {
  @Column({ name: '_id', type: 'varchar', length: 64, nullable: true })
  externalId: string | null

  @Column({ name: 'owner_id', type: 'varchar', length: 64 })
  ownerId: string

  @Column({ name: 'ladi_uid', type: 'varchar', length: 64, nullable: true })
  ladiUid: string | null

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ name: 'key_prefix', type: 'varchar', length: 32 })
  keyPrefix: string

  @Column({ name: 'key_hash', type: 'varchar', length: 128 })
  keyHash: string

  @Column({ type: 'jsonb', default: () => "'{}'" })
  scopes: Record<string, unknown>

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: ApiKeyStatus

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean

  @Column({ name: 'is_delete', type: 'boolean', default: false })
  isDelete: boolean

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, unknown>
}
