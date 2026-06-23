import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, EntityManager, In, Repository } from 'typeorm'

import { TenantContextService } from '@liora/nest-core'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

import {
  CrmPersonSegmentMapEntity,
  CrmPersonTagMapEntity,
  CustomerTagEntity,
  SegmentEntity,
} from '../entities'

export interface PersonRelationInput {
  tagIds?: number[]
  segmentIds?: number[]
}

@Injectable()
export class PersonRelationService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CrmPersonTagMapEntity)
    private readonly personTagMapRepository: Repository<CrmPersonTagMapEntity>,
    @InjectRepository(CrmPersonSegmentMapEntity)
    private readonly personSegmentMapRepository: Repository<CrmPersonSegmentMapEntity>,
    @InjectRepository(CustomerTagEntity)
    private readonly tagRepository: Repository<CustomerTagEntity>,
    @InjectRepository(SegmentEntity)
    private readonly segmentRepository: Repository<SegmentEntity>,
    private readonly dataSource: DataSource,
  ) {
    super(tenantContext)
  }

  async syncRelations(
    personId: string,
    dto: PersonRelationInput,
    manager?: EntityManager,
  ): Promise<void> {
    const run = async (em: EntityManager) => {
      if (dto.tagIds) {
        await em.getRepository(CrmPersonTagMapEntity).delete({ personId })
        if (dto.tagIds.length) {
          await em.getRepository(CrmPersonTagMapEntity).save(
            dto.tagIds.map((tagId) => ({ personId, tagId })),
          )
        }
      }

      if (dto.segmentIds) {
        await em.getRepository(CrmPersonSegmentMapEntity).delete({ personId })
        if (dto.segmentIds.length) {
          await em.getRepository(CrmPersonSegmentMapEntity).save(
            dto.segmentIds.map((segmentId) => ({ personId, segmentId })),
          )
        }
      }
    }

    if (manager) {
      await run(manager)
      return
    }

    await this.dataSource.transaction(run)
  }

  async removeRelations(personId: string): Promise<void> {
    await this.personTagMapRepository.delete({ personId })
    await this.personSegmentMapRepository.delete({ personId })
  }

  async getTagNames(personId: string): Promise<string[]> {
    const maps = await this.personTagMapRepository.find({ where: { personId } })
    if (!maps.length) {
      return []
    }

    const tags = await this.tagRepository.find({
      where: {
        id: In(maps.map((m) => m.tagId)),
        tenantId: this.requireTenantId(),
      },
    })
    return tags.map((t) => t.name)
  }

  async getPrimarySegmentName(personId: string): Promise<string | undefined> {
    const map = await this.personSegmentMapRepository.findOne({
      where: { personId },
      order: { id: 'ASC' },
    })
    if (!map) {
      return undefined
    }

    const segment = await this.segmentRepository.findOne({
      where: { id: map.segmentId, tenantId: this.requireTenantId() },
    })
    return segment?.name
  }
}