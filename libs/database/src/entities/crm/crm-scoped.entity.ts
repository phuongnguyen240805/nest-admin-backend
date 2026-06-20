import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

/**
 * Base for CRM tables — UUID PK, soft delete, tenant scoping.
 */
export abstract class CrmScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null

  @Column({ name: 'create_by', nullable: true })
  createBy: number | null

  @Column({ name: 'update_by', nullable: true })
  updateBy: number | null

  @Column({ type: 'int' })
  @Index()
  tenantId: number
}