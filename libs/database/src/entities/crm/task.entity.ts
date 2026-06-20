import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm'

import { CrmScopedEntity } from './crm-scoped.entity'
import { CrmCompanyEntity } from './company.entity'
import { CrmOpportunityEntity } from './opportunity.entity'
import { CrmPersonEntity } from './person.entity'
import type { CrmTaskStatus } from './types'

@Entity('crm_task')
export class CrmTaskEntity extends CrmScopedEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string

  @Column({ type: 'text', nullable: true })
  body: string | null

  @Column({ type: 'varchar', length: 20, default: 'TODO' })
  status: CrmTaskStatus

  @Column({ name: 'due_date', type: 'timestamp', nullable: true })
  dueDate: Date | null

  @Column({ name: 'person_id', type: 'uuid', nullable: true })
  @Index()
  personId: string | null

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId: string | null

  @Column({ name: 'opportunity_id', type: 'uuid', nullable: true })
  opportunityId: string | null

  @Column({ name: 'assignee_id', type: 'int', nullable: true })
  assigneeId: number | null

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