import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

import type {
  AdsProvider,
  AdsSnapshotConfidence,
  AdsSnapshotSource,
} from '@liora/ads-contracts'

@Entity('lp_ads_snapshot')
@Index('idx_lp_ads_snapshot_account_time', [
  'tenantId',
  'provider',
  'externalAccountId',
  'observedAt',
])
@Index(
  'uq_lp_ads_snapshot_fingerprint',
  ['tenantId', 'provider', 'externalAccountId', 'source', 'fingerprint'],
  { unique: true },
)
export class AdsSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'int' })
  tenantId: number

  @Column({ name: 'connection_id', type: 'uuid', nullable: true })
  connectionId: string | null

  @Column({ type: 'varchar', length: 16 })
  provider: AdsProvider

  @Column({ type: 'varchar', length: 32 })
  source: AdsSnapshotSource

  @Column({ type: 'varchar', length: 24 })
  confidence: AdsSnapshotConfidence

  @Column({ name: 'external_account_id', type: 'varchar', length: 128 })
  externalAccountId: string

  @Column({ name: 'schema_version', type: 'int' })
  schemaVersion: number

  @Column({ type: 'varchar', length: 64 })
  fingerprint: string

  @Column({ name: 'observed_at', type: 'timestamptz' })
  observedAt: Date

  @Column({ name: 'stale_at', type: 'timestamptz', nullable: true })
  staleAt: Date | null

  @Column({ type: 'jsonb' })
  completeness: Record<string, unknown>

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date
}
