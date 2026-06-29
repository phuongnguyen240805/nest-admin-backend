import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_domain')
@Index(['tenantId', 'externalId'], { unique: true })
@Index(['tenantId', 'domain'])
export class DomainEntity extends TenantScopedEntity {
  @Column({ name: '_id', type: 'varchar', length: 64 })
  externalId: string

  @Column({ type: 'varchar', length: 255 })
  domain: string

  @Column({ name: 'is_subdomain', type: 'boolean', default: false })
  isSubdomain: boolean

  @Column({ name: 'subdomain_default', type: 'varchar', length: 255, default: '' })
  subdomainDefault: string

  @Column({ type: 'boolean', default: true })
  status: boolean

  @Column({ name: 'is_preview', type: 'boolean', default: false })
  isPreview: boolean

  @Column({ name: 'is_ssl', type: 'boolean', default: false })
  isSsl: boolean

  @Column({ name: 'publish_platform', type: 'varchar', length: 50 })
  publishPlatform: string

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean

  @Column({ name: 'is_delete', type: 'boolean', default: false })
  isDelete: boolean

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean

  @Column({ name: 'is_hidden', type: 'boolean', default: false })
  isHidden: boolean
}
