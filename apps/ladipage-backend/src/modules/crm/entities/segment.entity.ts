import { Column, Entity } from 'typeorm'

import { TenantScopedEntity } from '~/common/entities/tenant-scoped.entity'

@Entity('lp_segment')
export class SegmentEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'boolean', default: false })
  isDefault: boolean

  @Column({ type: 'jsonb', nullable: true })
  rules: Record<string, unknown> | null
}