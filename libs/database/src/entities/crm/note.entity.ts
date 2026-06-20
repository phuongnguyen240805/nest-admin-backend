import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm'

import { CrmScopedEntity } from './crm-scoped.entity'
import { CrmCompanyEntity } from './company.entity'
import { CrmOpportunityEntity } from './opportunity.entity'
import { CrmPersonEntity } from './person.entity'

@Entity('crm_note')
export class CrmNoteEntity extends CrmScopedEntity {
  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null

  @Column({ type: 'text' })
  body: string

  @Column({ name: 'person_id', type: 'uuid', nullable: true })
  @Index()
  personId: string | null

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string | null

  @Column({ name: 'opportunity_id', type: 'uuid', nullable: true })
  opportunityId: string | null

  @ManyToOne(() => CrmPersonEntity)
  @JoinColumn({ name: 'person_id' })
  person?: CrmPersonEntity

  @ManyToOne(() => CrmCompanyEntity)
  @JoinColumn({ name: 'company_id' })
  company?: CrmCompanyEntity

  @ManyToOne(() => CrmOpportunityEntity)
  @JoinColumn({ name: 'opportunity_id' })
  opportunity?: CrmOpportunityEntity
}