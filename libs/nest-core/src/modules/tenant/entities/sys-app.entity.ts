import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm'

@Entity('sys_app')
export class SysAppEntity {
  @PrimaryColumn({ length: 50 })
  code: string

  @Column({ length: 255 })
  name: string

  @Column({ length: 20, default: 'active' })
  status: 'active' | 'inactive'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date
}