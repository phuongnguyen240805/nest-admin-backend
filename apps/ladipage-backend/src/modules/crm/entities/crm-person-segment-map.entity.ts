import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('crm_person_segment_map')
@Index(['personId', 'segmentId'], { unique: true })
export class CrmPersonSegmentMapEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'uuid' })
  personId: string

  @Column({ type: 'int' })
  segmentId: number
}