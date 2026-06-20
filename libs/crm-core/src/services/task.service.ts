import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'

import { CrmTaskEntity } from '@liora/database/entities/crm'
import type { CrmTaskStatus } from '@liora/database/entities/crm'
import { TenantContextService } from '@liora/nest-core'
import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'

import { CrmActivityService } from './activity.service'
import { CrmTenantScopedService } from './crm-tenant-scoped.service'

export interface TaskListQuery {
  page?: number
  pageSize?: number
  personId?: string
  opportunityId?: string
  status?: CrmTaskStatus
}

export interface CreateTaskInput {
  title: string
  body?: string | null
  status?: CrmTaskStatus
  dueDate?: Date | null
  personId?: string | null
  companyId?: string | null
  opportunityId?: string | null
  assigneeId?: number | null
}

export interface UpdateTaskInput {
  title?: string
  body?: string | null
  status?: CrmTaskStatus
  dueDate?: Date | null
  assigneeId?: number | null
}

@Injectable()
export class CrmTaskService extends CrmTenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CrmTaskEntity)
    private readonly taskRepository: Repository<CrmTaskEntity>,
    private readonly activityService: CrmActivityService,
    private readonly dataSource: DataSource,
  ) {
    super(tenantContext)
  }

  async list(query: TaskListQuery): Promise<Pagination<CrmTaskEntity>> {
    const tenantId = this.requireTenantId()
    const qb = this.taskRepository
      .createQueryBuilder('task')
      .where('task.tenantId = :tenantId', { tenantId })
      .andWhere('task.deletedAt IS NULL')

    if (query.personId) {
      qb.andWhere('task.personId = :personId', { personId: query.personId })
    }
    if (query.opportunityId) {
      qb.andWhere('task.opportunityId = :opportunityId', {
        opportunityId: query.opportunityId,
      })
    }
    if (query.status) {
      qb.andWhere('task.status = :status', { status: query.status })
    }

    qb.orderBy('task.dueDate', 'ASC', 'NULLS LAST').addOrderBy('task.createdAt', 'DESC')
    return paginate(qb, { page: query.page, pageSize: query.pageSize })
  }

  async detail(id: string): Promise<CrmTaskEntity> {
    return this.findOneForTenantOrFail(
      this.taskRepository,
      { id },
      'Task not found',
    )
  }

  async create(input: CreateTaskInput): Promise<CrmTaskEntity> {
    const tenantId = this.requireTenantId()

    return this.dataSource.transaction(async (manager) => {
      const task = await manager.getRepository(CrmTaskEntity).save({
        tenantId,
        title: input.title,
        body: input.body ?? null,
        status: input.status ?? 'TODO',
        dueDate: input.dueDate ?? null,
        personId: input.personId ?? null,
        companyId: input.companyId ?? null,
        opportunityId: input.opportunityId ?? null,
        assigneeId: input.assigneeId ?? null,
      })

      await this.activityService.log(
        {
          name: `Task created: ${task.title}`,
          action: 'CREATED',
          targetType: 'task',
          targetId: task.id,
          personId: task.personId,
          opportunityId: task.opportunityId,
        },
        manager,
      )

      return task
    })
  }

  async update(id: string, input: UpdateTaskInput): Promise<CrmTaskEntity> {
    const task = await this.detail(id)

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CrmTaskEntity)
      await repo.update(task.id, {
        title: input.title ?? task.title,
        body: input.body !== undefined ? input.body : task.body,
        status: input.status ?? task.status,
        dueDate: input.dueDate !== undefined ? input.dueDate : task.dueDate,
        assigneeId:
          input.assigneeId !== undefined ? input.assigneeId : task.assigneeId,
      })

      const updated = await repo.findOne({ where: { id: task.id } })

      await this.activityService.log(
        {
          name: `Task updated: ${updated!.title}`,
          action: 'UPDATED',
          targetType: 'task',
          targetId: task.id,
          personId: updated!.personId,
          opportunityId: updated!.opportunityId,
          properties: { changes: input },
        },
        manager,
      )

      return updated!
    })
  }

  async remove(id: string): Promise<void> {
    const task = await this.detail(id)
    await this.taskRepository.softRemove(task)
  }
}