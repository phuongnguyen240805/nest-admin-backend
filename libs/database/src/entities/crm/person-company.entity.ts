import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { CrmCompanyEntity } from './company.entity'
import { CrmPersonEntity } from './person.entity'

@Entity('crm_person_company')
@Index(['personId', 'companyId'], { unique: true })
export class CrmPersonCompanyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string

  @ManyToOne(() => CrmPersonEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id' })
  person?: CrmPersonEntity

  @ManyToOne(() => CrmCompanyEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company?: CrmCompanyEntity
}