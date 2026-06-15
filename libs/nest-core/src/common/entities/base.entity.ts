import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * BaseEntity - Abstract base entity for all domain entities in the system.
 * Designed for reusability across all modules (FunnelX, Publish, Credit, Website, etc.).
 *
 * Features:
 * - UUID primary key (recommended for distributed systems)
 * - Automatic timestamp management
 * - Soft delete support via deletedAt
 * - Multi-tenant support via workspaceId (critical for LadiPage isolation)
 *
 * Usage:
 *   export class Funnel extends BaseEntity {
 *     // your columns
 *   }
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Workspace / Tenant identifier.
   * Every record belonging to a user/team/brand should be scoped by this.
   * Enforced via @Workspace() decorator + query filters in services.
   */
  @Column({ type: 'uuid', nullable: false })
  @Index()
  workspaceId: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  /**
   * Soft delete column.
   * When set, the record is considered deleted.
   * Use repository.softRemove() or softDelete() to populate this field.
   */
  @DeleteDateColumn({ type: 'timestamp with time zone', nullable: true })
  deletedAt?: Date;
}
