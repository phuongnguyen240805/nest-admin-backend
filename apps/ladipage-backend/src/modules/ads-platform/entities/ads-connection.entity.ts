import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

import type { AdsProvider } from '@liora/ads-contracts'

import { AdsSecretEntity } from './ads-secret.entity'

export type AdsConnectionStatus =
  | 'CONNECTED'
  | 'EXPIRED'
  | 'REAUTHORIZATION_REQUIRED'
  | 'DISCONNECTED'

@Entity('lp_ads_connection')
@Index('uq_lp_ads_connection_tenant_provider_user', ['tenantId', 'provider', 'externalUserId'], {
  unique: true,
})
@Index('idx_lp_ads_connection_tenant_status', ['tenantId', 'status'])
export class AdsConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'int' })
  tenantId: number

  @Column({ type: 'varchar', length: 16 })
  provider: AdsProvider

  @Column({ name: 'external_user_id', type: 'varchar', length: 128 })
  externalUserId: string

  @Column({ name: 'display_name', type: 'varchar', length: 255, nullable: true })
  displayName: string | null

  @Column({ type: 'varchar', length: 32, default: 'CONNECTED' })
  status: AdsConnectionStatus

  @Column({ type: 'jsonb', default: () => "'[]'" })
  scopes: string[]

  @Column({ name: 'token_expires_at', type: 'timestamptz', nullable: true })
  tokenExpiresAt: Date | null

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, unknown>

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date

  @OneToOne(() => AdsSecretEntity, (secret) => secret.connection)
  secret?: AdsSecretEntity
}
