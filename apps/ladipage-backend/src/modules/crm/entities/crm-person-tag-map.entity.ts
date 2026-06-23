import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('crm_person_tag_map')
@Index(['personId', 'tagId'], { unique: true })
export class CrmPersonTagMapEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'uuid' })
  personId: string

  @Column({ type: 'int' })
  tagId: number
}