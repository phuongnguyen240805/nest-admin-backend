import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

export type CommerceStoreMode = 'hosted_shared' | 'byo_medusa'
export type CommerceStoreStatus = 'pending' | 'active' | 'suspended' | 'error'

/**
 * Links a LadiPage organization to a Medusa Sales Channel (ADR-005).
 * One row per (tenant, organization). Isolation is enforced by tenantId
 * (TenantScopedEntity) and every Admin query must additionally scope by
 * the row's salesChannelId to prevent cross-tenant catalog leaks.
 */
@Entity('commerce_store_link')
@Index(['tenantId', 'organizationId'], { unique: true })
export class CommerceStoreLinkEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 64 })
  organizationId: string

  @Column({ type: 'varchar', length: 20, default: 'hosted_shared' })
  mode: CommerceStoreMode

  /** Medusa sales channel id (sc_...). Null until provisioning completes. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  salesChannelId: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  salesChannelName: string | null

  /**
   * Medusa publishable API key id (apk_...) scoped to this channel.
   * The key value itself is never stored here; the id is enough to
   * reference/rotate it via Admin API.
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  publishableKeyId: string | null

  /** Preview only (first 8 chars) for FE display; never the full secret. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  publishableKeyPreview: string | null

  @Column({ type: 'varchar', length: 100, nullable: true })
  regionId: string | null

  @Column({ type: 'varchar', length: 10, default: 'vnd' })
  currencyCode: string

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: CommerceStoreStatus

  @Column({ type: 'varchar', length: 500, nullable: true })
  healthMessage: string | null

  @Column({ type: 'timestamp', nullable: true })
  provisionedAt: Date | null

  @Column({ type: 'timestamp', nullable: true })
  lastHealthCheckAt: Date | null
}
