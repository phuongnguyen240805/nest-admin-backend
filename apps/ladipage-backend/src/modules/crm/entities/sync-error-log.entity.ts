import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '~/common/entities/tenant-scoped.entity'

@Entity('lp_sync_error_log')
@Index(['customerId'])
export class SyncErrorLogEntity extends TenantScopedEntity {
  @Column({ type: 'int', nullable: true })
  customerId: number | null

  @Column({ type: 'varchar', length: 50 })
  errorCode: string

  @Column({ type: 'varchar', length: 100 })
  actionType: string

  @Column({ type: 'text' })
  errorContent: string
}