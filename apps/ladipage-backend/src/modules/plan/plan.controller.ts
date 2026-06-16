import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Public } from '@liora/nest-core'
import { PlanService } from './plan.service'

@ApiTags('plans')
@ApiBearerAuth()
@Controller('plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List available subscription plans (Free / Pro / Enterprise)' })
  listPlans() {
    return this.planService.listPlans()
  }
}