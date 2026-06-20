import { Column, Entity, Index } from 'typeorm'

import { CrmScopedEntity } from './crm-scoped.entity'
import type { CrmEmailEntry, CrmPersonStatus, CrmPhoneEntry } from './types'

@Entity('crm_person')
@Index(['tenantId', 'primaryPhone'])
@Index(['tenantId', 'primaryEmail'])
export class CrmPersonEntity extends CrmScopedEntity {
  @Column({ type: 'text' })
  name: string

  @Column({ name: 'first_name', type: 'varchar', length: 255, nullable: true })
  firstName: string | null

  @Column({ name: 'last_name', type: 'varchar', length: 255, nullable: true })
  lastName: string | null

  @Column({ type: 'jsonb', default: () => "'[]'" })
  emails: CrmEmailEntry[]

  @Column({ type: 'jsonb', default: () => "'[]'" })
  phones: CrmPhoneEntry[]

  @Column({ name: 'primary_email', type: 'varchar', length: 255, nullable: true })
  primaryEmail: string | null

  @Column({ name: 'primary_phone', type: 'varchar', length: 30, nullable: true })
  primaryPhone: string | null

  @Column({ name: 'job_title', type: 'varchar', length: 255, nullable: true })
  jobTitle: string | null

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: CrmPersonStatus

  @Column({
    name: 'search_vector',
    type: 'tsvector',
    select: false,
    nullable: true,
  })
  searchVector?: string | null
}