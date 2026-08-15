import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_automation_sequence')
@Index(['tenantId', 'externalId'], { unique: true })
@Index(['tenantId', 'status'])
export class AutomationSequenceEntity extends TenantScopedEntity {
  @Column({ name: '_id', type: 'varchar', length: 64 })
  externalId: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 30, default: 'DRAFT' })
  status: string

  @Column({ type: 'boolean', default: true })
  active: boolean

  @Column({ type: 'varchar', length: 80, default: 'UTC' })
  timezone: string

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  config: Record<string, unknown>

  @Column({ name: 'is_delete', type: 'boolean', default: false })
  isDelete: boolean
}
