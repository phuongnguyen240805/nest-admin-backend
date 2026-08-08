import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

import type { AdsProvider } from '@liora/ads-contracts'

@Entity('lp_ads_account')
@Index('uq_lp_ads_account_tenant_provider_external', ['tenantId', 'provider', 'externalId'], {
  unique: true,
})
@Index('idx_lp_ads_account_connection', ['tenantId', 'connectionId'])
export class AdsAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'int' })
  tenantId: number

  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId: string

  @Column({ type: 'varchar', length: 16 })
  provider: AdsProvider

  @Column({ name: 'external_id', type: 'varchar', length: 128 })
  externalId: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 16, nullable: true })
  currency: string | null

  @Column({ type: 'varchar', length: 128, nullable: true })
  timezone: string | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  status: string | null

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, unknown>

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
