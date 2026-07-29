import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

import { CloudPhoneBookingStatus } from '../enums/cloud-phone.enums'

/**
 * A rental of one GADS device by a user. NestJS owns the rental/billing
 * lifecycle; GADS only knows the device is locked. `gadsUdid` is the GADS
 * device identifier this booking holds.
 */
@Entity('lp_cloud_phone_booking')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'gadsUdid'])
export class CloudPhoneBookingEntity extends TenantScopedEntity {
  /** Owning user id (from CurrentUser). */
  @Column({ type: 'varchar', length: 64 })
  userId: string

  /** GADS device UDID held by this booking. */
  @Column({ type: 'varchar', length: 128 })
  gadsUdid: string

  /** Cached display name for FE listing without re-hitting GADS. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  deviceName: string | null

  @Column({ type: 'varchar', length: 64 })
  planCode: string

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: CloudPhoneBookingStatus

  @Column({ type: 'timestamp', nullable: true })
  bookedAt: Date | null

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null

  @Column({ type: 'timestamp', nullable: true })
  releasedAt: Date | null
}
