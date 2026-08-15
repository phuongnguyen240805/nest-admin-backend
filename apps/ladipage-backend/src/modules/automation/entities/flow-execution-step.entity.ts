import { Column, Entity, Index } from 'typeorm'

import { TenantScopedEntity } from '@liora/nest-core/common/entities/tenant-scoped.entity'

@Entity('lp_flow_execution_step')
@Index(['tenantId', 'executionId', 'nodeId', 'logicalIteration'], { unique: true })
@Index(['tenantId', 'executionId', 'status'])
export class FlowExecutionStepEntity extends TenantScopedEntity {
  @Column({ name: 'execution_id', type: 'uuid' })
  executionId: string

  @Column({ name: 'node_id', type: 'varchar', length: 128 })
  nodeId: string

  @Column({ name: 'node_type', type: 'varchar', length: 80 })
  nodeType: string

  @Column({ name: 'logical_iteration', type: 'int', default: 0 })
  logicalIteration: number

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  status: string

  @Column({ type: 'int', default: 0 })
  attempt: number

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  input: Record<string, unknown>

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  output: Record<string, unknown>

  @Column({ type: 'text', nullable: true })
  error: string | null

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null
}
