import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

import type { CrmActivityAction, CrmActivityTargetType } from './types'

@Entity('crm_activity')
@Index(['tenantId', 'personId', 'happensAt'])
@Index(['tenantId', 'opportunityId', 'happensAt'])
export class CrmActivityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'int' })
  @Index()
  tenantId: number

  @CreateDateColumn({ name: 'happens_at' })
  happensAt: Date

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 30 })
  action: CrmActivityAction

  @Column({ name: 'target_type', type: 'varchar', length: 30 })
  targetType: CrmActivityTargetType

  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string

  @Column({ name: 'person_id', type: 'uuid', nullable: true })
  personId: string | null

  @Column({ name: 'opportunity_id', type: 'uuid', nullable: true })
  opportunityId: string | null

  @Column({ type: 'jsonb', nullable: true })
  properties: Record<string, unknown> | null
}