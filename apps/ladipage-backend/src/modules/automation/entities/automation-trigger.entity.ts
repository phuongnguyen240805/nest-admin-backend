import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_automation_trigger')
@Index(['tenantId', 'externalId'], { unique: true })
@Index(['tenantId', 'eventType', 'enabled'])
@Index(['tenantId', 'flowExternalId'])
export class AutomationTriggerEntity extends TenantScopedEntity {
  @Column({ name: '_id', type: 'varchar', length: 64 })
  externalId: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ name: 'flow_id', type: 'varchar', length: 64 })
  flowExternalId: string

  @Column({ name: 'event_type', type: 'varchar', length: 120 })
  eventType: string

  @Column({ type: 'boolean', default: false })
  enabled: boolean

  @Column({ type: 'int', default: 0 })
  priority: number

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  conditions: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  config: Record<string, unknown>

  @Column({ name: 'is_delete', type: 'boolean', default: false })
  isDelete: boolean
}
