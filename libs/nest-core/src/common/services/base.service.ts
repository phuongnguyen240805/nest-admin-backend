import {
  DataSource,
  EntityManager,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { NotFoundException } from '@nestjs/common';

import { BaseEntity } from '../entities/base.entity';
import { PaginationDto } from '../dto/pagination.dto';
import { FilterDto } from '../dto/filter.dto';

/**
 * BaseService - Abstract reusable service providing common CRUD operations.
 *
 * All future modules (FunnelX, Publish, Credit, etc.) should extend this class
 * to avoid repeating basic data access logic (DRY principle).
 *
 * Features:
 * - Generic over Entity type
 * - Pagination + filtering support
 * - Workspace (multi-tenant) scoping helpers
 * - Basic transaction support via withTransaction()
 *
 * Example usage in a module:
 *   export class FunnelService extends BaseService<Funnel> {
 *     constructor(...) {
 *       super(funnelRepository, dataSource);
 *     }
 *   }
 */
export abstract class BaseService<
  T extends BaseEntity & ObjectLiteral,
> {
  protected readonly repository: Repository<T>;
  protected readonly dataSource: DataSource;

  constructor(repository: Repository<T>, dataSource: DataSource) {
    this.repository = repository;
    this.dataSource = dataSource;
  }

  /**
   * Get the base alias used in QueryBuilder (defaults to entity name lowercased).
   */
  protected get alias(): string {
    return this.repository.metadata.tableName || 'entity';
  }

  /**
   * Create a scoped QueryBuilder that automatically filters by workspaceId (if provided).
   * This is the recommended way to ensure multi-tenant isolation.
   */
  protected createQueryBuilder(workspaceId?: string): SelectQueryBuilder<T> {
    const qb = this.repository.createQueryBuilder(this.alias);

    if (workspaceId) {
      qb.andWhere(`${this.alias}.workspaceId = :workspaceId`, { workspaceId });
    }

    // Always exclude soft-deleted by default unless caller wants them
    qb.andWhere(`${this.alias}.deletedAt IS NULL`);

    return qb;
  }

  /**
   * Find with pagination + basic filters.
   * Extend FilterDto in your module for more specific filters (e.g. status, date range).
   */
  async findMany(
    pagination: PaginationDto,
    filter?: FilterDto,
    workspaceId?: string,
  ): Promise<{ data: T[]; meta: any }> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC' } = pagination;

    const qb = this.createQueryBuilder(workspaceId);

    // Apply basic search if FilterDto has search term
    if (filter?.search) {
      // Simple ilike on common text fields - override in child service for better control
      qb.andWhere(
        `(${this.alias}.name ILIKE :search OR ${this.alias}.title ILIKE :search)`,
        { search: `%${filter.search}%` },
      );
    }

    // Sorting
    qb.orderBy(`${this.alias}.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');

    const skip = (page - 1) * limit;

    const [items, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, workspaceId?: string): Promise<T> {
    const qb = this.createQueryBuilder(workspaceId);
    const entity = await qb.andWhere(`${this.alias}.id = :id`, { id }).getOne();

    if (!entity) {
      throw new NotFoundException(`Record with id ${id} not found`);
    }
    return entity;
  }

  async create(dto: Partial<T>, workspaceId: string): Promise<T[]> {
    const entity = this.repository.create({
      ...dto,
      workspaceId,
    } as any);
    return this.repository.save(entity);
  }

  async update(id: string, dto: Partial<T>, workspaceId: string): Promise<T> {
    await this.findOne(id, workspaceId); // ensure exists + workspace match
    await this.repository.update({ id, workspaceId } as any, dto as any);
    return this.findOne(id, workspaceId);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const entity = await this.findOne(id, workspaceId);
    // Prefer soft delete for auditability
    await this.repository.softRemove(entity);
  }

  /**
   * Execute a block of code inside a database transaction.
   * Highly recommended for operations that touch multiple tables (e.g. Publish flow + Credit deduction).
   *
   * Example:
   *   await this.withTransaction(async (manager) => {
   *     // use manager.getRepository(...)
   *   });
   */
  async withTransaction<R>(
    work: (manager: EntityManager) => Promise<R>,
  ): Promise<R> {
    return this.dataSource.transaction(work);
  }
}
