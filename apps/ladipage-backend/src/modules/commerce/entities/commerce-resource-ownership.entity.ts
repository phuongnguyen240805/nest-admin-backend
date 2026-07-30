import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

/**
 * Local source of truth for ownership of Medusa Admin resources that are not
 * naturally isolated by Sales Channel (category, tag, customer, promotion).
 */
@Entity('commerce_resource_ownership')
@Index(
  ['tenantId', 'appId', 'environment', 'providerId', 'organizationId', 'resourceKind', 'externalId'],
  { unique: true },
)
@Index(['environment', 'providerId', 'resourceKind', 'externalId'], { unique: true })
export class CommerceResourceOwnershipEntity extends TenantScopedEntity {
  @Column({ type: 'varchar', length: 64, default: 'ladipage' })
  appId: string

  @Column({ type: 'varchar', length: 32, default: 'development' })
  environment: string

  /** Logical Medusa installation; prevents collisions when more apps are added. */
  @Column({ type: 'varchar', length: 64, default: 'medusa-primary' })
  providerId: string

  @Column({ type: 'varchar', length: 64 })
  organizationId: string

  @Column({ type: 'varchar', length: 32 })
  resourceKind: string

  @Column({ type: 'varchar', length: 128 })
  externalId: string
}
