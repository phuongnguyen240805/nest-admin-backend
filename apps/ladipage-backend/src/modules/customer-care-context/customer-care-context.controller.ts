import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'

import { TenantGuard } from '@liora/nest-core'

import { CustomerCaseTimelineService } from './customer-case-timeline.service'
import { CustomerCareContextService } from './customer-care-context.service'

@Controller('customer-care')
@UseGuards(TenantGuard)
export class CustomerCareContextController {
  constructor(
    private readonly timeline: CustomerCaseTimelineService,
    private readonly context: CustomerCareContextService,
  ) {}

  @Get('conversations/:id/context')
  contextForConversation(@Param('id') id: string) {
    return this.context.build({ conversationId: id })
  }

  @Get('conversations/:id/timeline')
  timelineForConversation(
    @Param('id') id: string,
    @Query('limit') rawLimit?: string,
  ) {
    const parsed = rawLimit ? Number(rawLimit) : 200
    const limit = Number.isInteger(parsed) ? parsed : 200
    return this.timeline.getTimeline(id, limit)
  }
}
