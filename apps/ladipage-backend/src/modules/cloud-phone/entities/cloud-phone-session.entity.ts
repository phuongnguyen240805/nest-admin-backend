import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

import { CloudPhoneSessionStatus } from '../enums/cloud-phone.enums'

/**
 * A remote-control session over a booking. Maps our sessionId to the GADS
 * session and records duration for billing/audit.
 */
@Entity('lp_cloud_phone_session')
@Index(['tenantId', 'bookingId'])
export class CloudPhoneSessionEntity extends TenantScopedEntity {
  @Column({ type: 'int' })
  bookingId: number

  /** GADS session identifier (null until GADS wiring lands). */
  @Column({ type: 'varchar', length: 128, nullable: true })
  gadsSessionId: string | null

  @Column({ type: 'varchar', length: 20, default: 'STARTING' })
  status: CloudPhoneSessionStatus

  /** Stream transport reported by GADS (mjpeg / webrtc). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  streamType: string | null

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null

  @Column({ type: 'int', default: 0 })
  durationSeconds: number
}
