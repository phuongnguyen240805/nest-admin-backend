import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_page')
@Index(['tenantId', 'externalId'], { unique: true })
@Index(['tenantId', 'storeId'])
@Index(['tenantId', 'ownerId'])
export class PageEntity extends TenantScopedEntity {
  @Column({ name: '_id', type: 'varchar', length: 64 })
  externalId: string

  @Column({ name: 'store_id', type: 'varchar', length: 64 })
  storeId: string

  @Column({ name: 'owner_id', type: 'varchar', length: 64 })
  ownerId: string

  @Column({ name: 'creator_id', type: 'varchar', length: 64 })
  creatorId: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 255 })
  alias: string

  @Column({ type: 'varchar', length: 50 })
  type: string

  @Column({ name: 'design_type', type: 'varchar', length: 50 })
  designType: string

  @Column({ name: 'publish_platform', type: 'varchar', length: 50, nullable: true })
  publishPlatform: string | null

  @Column({ name: 'origin_id', type: 'varchar', length: 64, nullable: true })
  originId: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  domain: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  path: string | null

  @Column({ name: 'page_url', type: 'varchar', length: 500, nullable: true })
  pageUrl: string | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  url: string | null

  @Column({ type: 'varchar', length: 255, default: '' })
  subdomain: string

  @Column({ type: 'boolean', default: false })
  https: boolean

  @Column({ name: 'is_publish', type: 'boolean', default: false })
  isPublish: boolean

  @Column({ name: 'is_delete', type: 'boolean', default: false })
  isDelete: boolean

  @Column({ name: 'backup_count', type: 'int', default: 0 })
  backupCount: number

  @Column({ name: 'last_update_source', type: 'timestamptz', nullable: true })
  lastUpdateSource: Date | null

  @Column({ name: 'last_update_source_mobile', type: 'timestamptz', nullable: true })
  lastUpdateSourceMobile: Date | null

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags: unknown[]

  @Column({ name: 'tag_ai', type: 'jsonb', default: () => "'[]'" })
  tagAi: unknown[]

  @Column({ name: 'content_versions', type: 'jsonb', default: () => "'[]'" })
  contentVersions: unknown[]

  @Column({ name: 'scope_users', type: 'jsonb', default: () => "'[]'" })
  scopeUsers: unknown[]

  @Column({ name: 'scope_teams', type: 'jsonb', default: () => "'[]'" })
  scopeTeams: unknown[]

  @Column({ name: 'user_scopes', type: 'jsonb', default: () => "'[]'" })
  userScopes: unknown[]

  @Column({ name: 'form_inputs', type: 'jsonb', default: () => "'[]'" })
  formInputs: unknown[]

  @Column({ type: 'jsonb', default: () => "'{}'" })
  tracking: Record<string, unknown>

  @Column({ name: 'tracking_total_visit', type: 'int', default: 0 })
  trackingTotalVisit: number

  @Column({ name: 'tracking_total_unique_visit', type: 'int', default: 0 })
  trackingTotalUniqueVisit: number

  @Column({ name: 'tracking_total_conversion', type: 'int', default: 0 })
  trackingTotalConversion: number

  @Column({ name: 'tracking_total_unique_conversion', type: 'int', default: 0 })
  trackingTotalUniqueConversion: number

  @Column({ name: 'tracking_cr', type: 'int', default: 0 })
  trackingCr: number

  @Column({ name: 'tracking_last_updated_at', type: 'timestamptz', nullable: true })
  trackingLastUpdatedAt: Date | null

  @Column({ type: 'jsonb', default: () => "'{}'" })
  revenue: Record<string, unknown>

  @Column({ name: 'revenue_total', type: 'int', default: 0 })
  revenueTotal: number

  @Column({ name: 'revenue_currency', type: 'varchar', length: 10, default: 'VND' })
  revenueCurrency: string

  @Column({ name: 'traking_data', type: 'text', nullable: true })
  trakingData: string | null

  @Column({ type: 'jsonb', nullable: true })
  source: Record<string, unknown> | null
}
