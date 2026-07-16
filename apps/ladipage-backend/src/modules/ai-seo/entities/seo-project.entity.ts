import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

import { SeoTaskEntity } from './seo-task.entity'

export type SeoProjectStatus = 'draft' | 'active' | 'archived'
export type SeoProjectTaskStatus = 'pending' | 'running' | 'done' | 'failed'
export type SeoProjectPixelTagState = 'not_installed' | 'installed'
export type SeoTrafficScriptState = 'not_installed' | 'installed' | 'unknown'

@Entity('lp_seo_project')
@Index('idx_lp_seo_project_tenant_landing', ['tenantId', 'landingPageId'])
@Index('idx_lp_seo_project_tenant_hostname', ['tenantId', 'hostname'])
export class SeoProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'tenant_id', type: 'int' })
  tenantId: number

  @Column({ name: 'store_id', type: 'varchar', length: 64, nullable: true })
  storeId: string | null

  @Column({ name: 'landing_page_id', type: 'uuid', nullable: true })
  landingPageId: string | null

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 255 })
  hostname: string

  @Column({ type: 'varchar', length: 255 })
  slug: string

  @Column({ type: 'varchar', length: 30, default: 'draft' })
  status: SeoProjectStatus

  @Column({ name: 'openseo_project_id', type: 'varchar', length: 128, nullable: true })
  openseoProjectId: string | null

  @Column({ name: 'task_status', type: 'varchar', length: 30, default: 'pending' })
  taskStatus: SeoProjectTaskStatus

  @Column({ name: 'pixel_tag_state', type: 'varchar', length: 30, default: 'not_installed' })
  pixelTagState: SeoProjectPixelTagState

  @Column({ name: 'is_favorite', type: 'boolean', default: false })
  isFavorite: boolean

  @Column({ name: 'is_engaged', type: 'boolean', default: true })
  isEngaged: boolean

  @Column({ name: 'holistic_scores', type: 'jsonb', default: () => "'{}'" })
  holisticScores: Record<string, unknown>

  @Column({ name: 'connected_data', type: 'jsonb', default: () => "'{}'" })
  connectedData: Record<string, unknown>

  @Column({ name: 'site_audit', type: 'jsonb', default: () => "'{}'" })
  siteAudit: Record<string, unknown>

  @Column({ name: 'last_analysis_at', type: 'timestamptz', nullable: true })
  lastAnalysisAt: Date | null

  @Column({ name: 'umami_website_id', type: 'varchar', length: 128, nullable: true })
  umamiWebsiteId: string | null

  @Column({ name: 'umami_share_id', type: 'varchar', length: 128, nullable: true })
  umamiShareId: string | null

  @Column({ name: 'traffic_script_state', type: 'varchar', length: 30, default: 'not_installed' })
  trafficScriptState: SeoTrafficScriptState

  @Column({ name: 'traffic_synced_at', type: 'timestamptz', nullable: true })
  trafficSyncedAt: Date | null

  @Column({ name: 'traffic_snapshot', type: 'jsonb', default: () => "'{}'" })
  trafficSnapshot: Record<string, unknown>

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date

  @OneToMany(() => SeoTaskEntity, (task) => task.project)
  tasks?: SeoTaskEntity[]
}
