import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

import { CrmCustomFieldDefEntity } from './custom-field-def.entity'
import { CrmOpportunityEntity } from './opportunity.entity'
import { CrmPersonEntity } from './person.entity'

@Entity('crm_custom_field_value')
@Index(['fieldId', 'personId'], { unique: true, where: '"person_id" IS NOT NULL' })
@Index(['fieldId', 'opportunityId'], {
  unique: true,
  where: '"opportunity_id" IS NOT NULL',
})
export class CrmCustomFieldValueEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'field_id', type: 'uuid' })
  fieldId: string

  @Column({ name: 'person_id', type: 'uuid', nullable: true })
  personId: string | null

  @Column({ name: 'opportunity_id', type: 'uuid', nullable: true })
  opportunityId: string | null

  @Column({ type: 'text', nullable: true })
  value: string | null

  @ManyToOne(() => CrmCustomFieldDefEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'field_id' })
  field?: CrmCustomFieldDefEntity

  @ManyToOne(() => CrmPersonEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id' })
  person?: CrmPersonEntity

  @ManyToOne(() => CrmOpportunityEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'opportunity_id' })
  opportunity?: CrmOpportunityEntity
}