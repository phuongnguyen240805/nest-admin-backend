import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

import type { AdsProvider } from '@liora/ads-contracts'

@Entity('lp_ads_audit_event')
@Index('idx_lp_ads_audit_tenant_time', ['tenantId', 'createdAt'])
@Index('idx_lp_ads_audit_operation', ['tenantId', 'operationId'])
export class AdsAuditEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'int' })
  tenantId: number

  @Column({ name: 'operation_id', type: 'uuid' })
  operationId: string

  @Column({ name: 'trace_id', type: 'varchar', length: 128 })
  traceId: string

  @Column({ name: 'actor_id', type: 'varchar', length: 128 })
  actorId: string

  @Column({ type: 'varchar', length: 16 })
  provider: AdsProvider

  @Column({ name: 'event_code', type: 'varchar', length: 96 })
  eventCode: string

  @Column({ type: 'varchar', length: 24 })
  outcome: 'STARTED' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'DENIED'

  @Column({ name: 'target_type', type: 'varchar', length: 64, nullable: true })
  targetType: string | null

  @Column({ name: 'target_id', type: 'varchar', length: 160, nullable: true })
  targetId: string | null

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, unknown>

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date
}
