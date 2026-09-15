import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

export type PublishJobStatus =
  | 'queued'
  | 'validating'
  | 'rendering'
  | 'writing_artifact'
  | 'updating_route'
  | 'published'
  | 'failed_retryable'
  | 'failed_final'
  | 'cancelled'

@Entity('lp_publish_job')
@Index(['jobId'], { unique: true })
@Index(['tenantId', 'userId', 'pageId', 'idempotencyKey'], { unique: true })
@Index(['tenantId', 'status', 'createdAt'])
export class PublishJobEntity extends TenantScopedEntity {
  @Column({ name: 'job_id', type: 'varchar', length: 64 })
  jobId: string

  @Column({ name: 'user_id', type: 'int' })
  userId: number

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string

  @Column({ name: 'page_id', type: 'varchar', length: 64 })
  pageId: string

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey: string

  @Column({ name: 'request_hash', type: 'varchar', length: 64 })
  requestHash: string

  @Column({ type: 'varchar', length: 32, default: 'queued' })
  status: PublishJobStatus

  @Column({ type: 'varchar', length: 64, default: 'queued' })
  step: string

  @Column({ type: 'int', default: 0 })
  progress: number

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload: Record<string, unknown>

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, unknown> | null

  @Column({ name: 'error_code', type: 'varchar', length: 64, nullable: true })
  errorCode: string | null

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null

  @Column({ name: 'queue_attempts', type: 'int', default: 0 })
  queueAttempts: number

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null
}
