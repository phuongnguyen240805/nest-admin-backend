import { Injectable } from '@nestjs/common'
import { PlanConfigService } from '@liora/nest-core'
import type { PlanDto } from '@liora/api-types'

@Injectable()
export class PlanService {
  constructor(private readonly planConfigService: PlanConfigService) {}

  listPlans(): PlanDto[] {
    return this.planConfigService.getPlans()
  }
}