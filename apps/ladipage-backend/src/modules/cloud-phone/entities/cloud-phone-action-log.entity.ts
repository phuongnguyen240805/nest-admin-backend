import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

import { CloudPhoneActionType } from '../enums/cloud-phone.enums'

/**
 * Audit trail for every control action (tap/swipe/input/install/script).
 * Required for reconciliation and compliance on the automation use-case.
 */
@Entity('lp_cloud_phone_action_log')
@Index(['tenantId', 'sessionId'])
export class CloudPhoneActionLogEntity extends TenantScopedEntity {
  @Column({ type: 'int' })
  sessionId: number

  @Column({ type: 'varchar', length: 32 })
  actionType: CloudPhoneActionType

  /** Free-form action payload (coordinates, text, appPackage, …). */
  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null
}
