import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'

import { CrmNoteEntity } from '@liora/database/entities/crm'
import { TenantContextService } from '@liora/nest-core'
import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'

import { CrmActivityService } from './activity.service'
import { CrmTenantScopedService } from './crm-tenant-scoped.service'

export interface NoteListQuery {
  page?: number
  pageSize?: number
  personId?: string
  opportunityId?: string
}

export interface CreateNoteInput {
  title?: string | null
  body: string
  personId?: string | null
  companyId?: string | null
  opportunityId?: string | null
}

export interface UpdateNoteInput {
  title?: string | null
  body?: string
}

@Injectable()
export class CrmNoteService extends CrmTenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CrmNoteEntity)
    private readonly noteRepository: Repository<CrmNoteEntity>,
    private readonly activityService: CrmActivityService,
    private readonly dataSource: DataSource,
  ) {
    super(tenantContext)
  }

  async list(query: NoteListQuery): Promise<Pagination<CrmNoteEntity>> {
    const tenantId = this.requireTenantId()
    const qb = this.noteRepository
      .createQueryBuilder('note')
      .where('note.tenantId = :tenantId', { tenantId })
      .andWhere('note.deletedAt IS NULL')

    if (query.personId) {
      qb.andWhere('note.personId = :personId', { personId: query.personId })
    }
    if (query.opportunityId) {
      qb.andWhere('note.opportunityId = :opportunityId', {
        opportunityId: query.opportunityId,
      })
    }

    qb.orderBy('note.createdAt', 'DESC')
    return paginate(qb, { page: query.page, pageSize: query.pageSize })
  }

  async detail(id: string): Promise<CrmNoteEntity> {
    return this.findOneForTenantOrFail(
      this.noteRepository,
      { id },
      'Note not found',
    )
  }

  async create(input: CreateNoteInput): Promise<CrmNoteEntity> {
    const tenantId = this.requireTenantId()

    return this.dataSource.transaction(async (manager) => {
      const note = await manager.getRepository(CrmNoteEntity).save({
        tenantId,
        title: input.title ?? null,
        body: input.body,
        personId: input.personId ?? null,
        companyId: input.companyId ?? null,
        opportunityId: input.opportunityId ?? null,
      })

      await this.activityService.log(
        {
          name: input.title ? `Note: ${input.title}` : 'Note added',
          action: 'CREATED',
          targetType: 'note',
          targetId: note.id,
          personId: note.personId,
          opportunityId: note.opportunityId,
        },
        manager,
      )

      return note
    })
  }

  async update(id: string, input: UpdateNoteInput): Promise<CrmNoteEntity> {
    const note = await this.detail(id)

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CrmNoteEntity)
      await repo.update(note.id, {
        title: input.title !== undefined ? input.title : note.title,
        body: input.body ?? note.body,
      })

      const updated = await repo.findOne({ where: { id: note.id } })

      await this.activityService.log(
        {
          name: 'Note updated',
          action: 'UPDATED',
          targetType: 'note',
          targetId: note.id,
          personId: updated!.personId,
          opportunityId: updated!.opportunityId,
        },
        manager,
      )

      return updated!
    })
  }

  async remove(id: string): Promise<void> {
    const note = await this.detail(id)
    await this.noteRepository.softRemove(note)
  }
}