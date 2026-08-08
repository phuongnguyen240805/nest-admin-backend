import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

import type { AdsOperationState, AdsProvider } from '@liora/ads-contracts'

export type AdsJobType = 'SYNC' | 'PUBLISH' | 'ACTION' | 'RECONCILE'

@Entity('lp_ads_job')
@Index('uq_lp_ads_job_idempotency', ['tenantId', 'idempotencyKey'], { unique: true })
@Index('idx_lp_ads_job_tenant_state', ['tenantId', 'state', 'createdAt'])
export class AdsJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'int' })
  tenantId: number

  @Column({ name: 'actor_id', type: 'varchar', length: 128 })
  actorId: string

  @Column({ type: 'varchar', length: 16 })
  provider: AdsProvider

  @Column({ type: 'varchar', length: 16 })
  type: AdsJobType

  @Column({ type: 'varchar', length: 24, default: 'CREATED' })
  state: AdsOperationState

  @Column({ name: 'idempotency_key', type: 'varchar', length: 160 })
  idempotencyKey: string

  @Column({ name: 'connection_id', type: 'uuid', nullable: true })
  connectionId: string | null

  @Column({ name: 'external_account_id', type: 'varchar', length: 128, nullable: true })
  externalAccountId: string | null

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'{}'" })
  checkpoint: Record<string, unknown>

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, unknown> | null

  @Column({ type: 'jsonb', nullable: true })
  error: Record<string, unknown> | null

  @Column({ name: 'bull_job_id', type: 'varchar', length: 128, nullable: true })
  bullJobId: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null
}
