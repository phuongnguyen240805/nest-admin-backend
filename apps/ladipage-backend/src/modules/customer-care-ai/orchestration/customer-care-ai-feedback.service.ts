import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { TenantContextService } from '@liora/nest-core'
import { CustomerCareAiFeedbackEntity, CustomerCareAiResultEntity } from '../entities'

@Injectable()
export class CustomerCareAiFeedbackService {
  constructor(
    private readonly tenantContext: TenantContextService,
    @InjectRepository(CustomerCareAiResultEntity) private readonly results: Repository<CustomerCareAiResultEntity>,
    @InjectRepository(CustomerCareAiFeedbackEntity) private readonly feedback: Repository<CustomerCareAiFeedbackEntity>,
  ) {}

  async add(resultId: string, userId: number, dto: { rating: number; reason?: string; editedContent?: string }) {
    const tenantId = this.tenantContext.getTenantId()
    if (tenantId == null) throw new ForbiddenException('Tenant ID is required')
    const result = await this.results.findOne({ where: { id: resultId, tenantId } })
    if (!result) throw new NotFoundException('AI result not found')
    return this.feedback.save(this.feedback.create({
      tenantId, resultId, userId, rating: dto.rating, reason: dto.reason?.trim() || null, editedContent: dto.editedContent ?? null,
    }))
  }
}
