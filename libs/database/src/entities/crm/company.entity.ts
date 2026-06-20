import { Column, Entity, Index } from 'typeorm'

import { CrmScopedEntity } from './crm-scoped.entity'
import type { CrmLinkEntry } from './types'

@Entity('crm_company')
@Index(['tenantId', 'domain'], { unique: true, where: '"domain" IS NOT NULL' })
export class CrmCompanyEntity extends CrmScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  domain: string | null

  @Column({ type: 'jsonb', default: () => "'{}'" })
  links: CrmLinkEntry

  @Column({
    name: 'search_vector',
    type: 'tsvector',
    select: false,
    nullable: true,
  })
  searchVector?: string | null
}