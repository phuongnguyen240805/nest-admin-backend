import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('cc_ai_feedback')
@Index(['tenantId', 'resultId', 'userId'])
export class CustomerCareAiFeedbackEntity {
  @PrimaryGeneratedColumn() id: number
  @Column({ name: 'tenant_id', type: 'int' }) tenantId: number
  @Column({ name: 'result_id', type: 'uuid' }) resultId: string
  @Column({ name: 'user_id', type: 'int' }) userId: number
  @Column({ type: 'smallint' }) rating: number
  @Column({ type: 'varchar', length: 500, nullable: true }) reason: string | null
  @Column({ name: 'edited_content', type: 'text', nullable: true }) editedContent: string | null
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date
}
