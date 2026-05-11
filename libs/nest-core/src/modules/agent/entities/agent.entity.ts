import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  //   ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { Organization } from '~/modules/billing/entities/organization.entity'

export enum AgentCategory {
  CONTENT = 'content',
  VIDEO = 'video',
  SOCIAL = 'social',
  ANALYSIS = 'analysis',
  AUTOMATION = 'automation',
}

@Entity('sys_agent')
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ length: 255 })
  name: string

  @Column({ type: 'enum', enum: AgentCategory })
  category: AgentCategory

  @Column({ type: 'simple-array', nullable: true })
  topics: string[] // ví dụ: ["content", "video", "social"]

  @Column({ type: 'json', nullable: true })
  graphJson: any // LangGraph / JSON graph definition

  @Column({ nullable: true })
  description?: string

  @Column({ default: true })
  isActive: boolean

  @Column({ type: 'uuid', nullable: false })
  organizationId: string

  //   @ManyToOne(() => Organization, org => org.agents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @DeleteDateColumn()
  deletedAt?: Date
}
