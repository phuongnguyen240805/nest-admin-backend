import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { paginate } from '@liora/nest-core/helper/paginate'
import { Pagination } from '@liora/nest-core/helper/paginate/pagination'
import { TenantContextService } from '@liora/nest-core'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'

import { ErrorLogQueryDto } from '../dto/error-log.dto'
import { CustomerEntity, SyncErrorLogEntity } from '../entities'

@Injectable()
export class ErrorLogService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(SyncErrorLogEntity)
    private readonly errorLogRepository: Repository<SyncErrorLogEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepository: Repository<CustomerEntity>,
  ) {
    super(tenantContext)
  }

  async list(dto: ErrorLogQueryDto) {
    const tenantId = this.requireTenantId()
    const qb = this.errorLogRepository
      .createQueryBuilder('log')
      .where('log.tenantId = :tenantId', { tenantId })

    if (dto.search) {
      qb.andWhere(
        '(log.errorCode ILIKE :search OR log.actionType ILIKE :search OR log.errorContent ILIKE :search)',
        { search: `%${dto.search}%` },
      )
    }

    qb.orderBy('log.createdAt', 'DESC')
    const result = await paginate(qb, { page: dto.page, pageSize: dto.pageSize })

    const items = await Promise.all(
      result.items.map(async (log) => {
        let customer = ''
        if (log.customerId) {
          const entity = await this.customerRepository.findOne({
            where: { id: log.customerId, tenantId },
          })
          customer = entity?.name ?? ''
        }
        return {
          ...log,
          time: log.createdAt,
          customer,
        }
      }),
    )

    return new Pagination(items, result.meta)
  }
}