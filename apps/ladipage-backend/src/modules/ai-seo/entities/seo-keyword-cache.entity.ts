import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm'

@Entity('lp_seo_keyword_cache')
@Index('idx_lp_seo_keyword_cache_expires_at', ['expiresAt'])
export class SeoKeywordCacheEntity {
  @PrimaryColumn({ name: 'tenant_id', type: 'int' })
  tenantId: number

  @PrimaryColumn({ name: 'seed_hash', type: 'varchar', length: 128 })
  seedHash: string

  @Column({ type: 'jsonb', default: () => "'{}'" })
  response: Record<string, unknown>

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
