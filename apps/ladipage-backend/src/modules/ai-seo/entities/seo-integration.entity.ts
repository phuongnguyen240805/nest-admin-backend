import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export type SeoIntegrationProvider = 'dataforseo' | 'gsc' | 'gbp'

@Entity('lp_seo_integration')
@Index('idx_lp_seo_integration_tenant_provider', ['tenantId', 'provider'], { unique: true })
export class SeoIntegrationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'int' })
  tenantId: number

  @Column({ type: 'varchar', length: 30 })
  provider: SeoIntegrationProvider

  @Column({ name: 'encrypted_credentials', type: 'jsonb', default: () => "'{}'" })
  encryptedCredentials: Record<string, unknown>

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
