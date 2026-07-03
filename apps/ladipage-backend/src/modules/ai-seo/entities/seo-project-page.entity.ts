import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

import { SeoProjectEntity } from './seo-project.entity'

export type SeoProjectPageScanStatus = 'pending' | 'scanning' | 'completed' | 'failed'
export type SeoProjectPageSource = 'internal' | 'external'

@Entity('lp_seo_project_page')
@Index('idx_lp_seo_project_page_project', ['seoProjectId'])
export class SeoProjectPageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'int' })
  tenantId: number

  @Column({ name: 'seo_project_id', type: 'uuid' })
  seoProjectId: string

  @Column({ name: 'page_url', type: 'varchar', length: 500 })
  pageUrl: string

  @Column({ name: 'website_page_id', type: 'varchar', length: 128, nullable: true })
  websitePageId: string | null

  @Column({ type: 'varchar', length: 20, default: 'external' })
  source: SeoProjectPageSource

  @Column({ name: 'scan_status', type: 'varchar', length: 30, default: 'pending' })
  scanStatus: SeoProjectPageScanStatus

  @Column({ name: 'last_scan_job_id', type: 'varchar', length: 128, nullable: true })
  lastScanJobId: string | null

  @Column({ name: 'last_scanned_at', type: 'timestamptz', nullable: true })
  lastScannedAt: Date | null

  @Column({ type: 'jsonb', default: () => "'{}'" })
  scores: Record<string, unknown>

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date

  @ManyToOne(() => SeoProjectEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seo_project_id' })
  project?: SeoProjectEntity
}