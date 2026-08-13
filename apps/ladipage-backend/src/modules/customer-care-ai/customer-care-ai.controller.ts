import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser, RequestTimeoutMs, TenantGuard } from '@liora/nest-core'
import { AnalyzeCustomerCareConversationDto, CustomerCareAiActionDecisionDto, CustomerCareAiFeedbackDto, GenerateCustomerCareAiReplyDto, UpdateCustomerCareAiConfigDto } from './dto/customer-care-ai.dto'
import { CustomerCareAiFeedbackService } from './orchestration/customer-care-ai-feedback.service'
import { CustomerCareAiActionService } from './actions/customer-care-ai-action.service'
import { CustomerCareAiMetricsService } from './observability/customer-care-ai-metrics.service'
import { CustomerCareAiHealthService } from './observability/customer-care-ai-health.service'
import { CustomerCareAiConfigService } from './config/customer-care-ai-config.service'
import { CustomerCareAiOrchestratorService } from './orchestration/customer-care-ai-orchestrator.service'

function uid(user: any) { return Number(user?.uid || user?.id || 0) }

@ApiTags('Customer Care AI')
@ApiBearerAuth()
@Controller('customer-care')
@UseGuards(TenantGuard)
export class CustomerCareAiController {
  constructor(
    private readonly orchestrator: CustomerCareAiOrchestratorService,
    private readonly feedback: CustomerCareAiFeedbackService,
    private readonly actions: CustomerCareAiActionService,
    private readonly config: CustomerCareAiConfigService,
    private readonly health: CustomerCareAiHealthService,
    private readonly metrics: CustomerCareAiMetricsService,
  ) {}

  @Post('conversations/:id/ai/reply')
  @RequestTimeoutMs(110_000)
  reply(@Param('id') id: string, @Body() dto: GenerateCustomerCareAiReplyDto, @CurrentUser() user: any) {
    return this.orchestrator.reply(id, uid(user), dto)
  }

  @Post('conversations/:id/ai/analyze')
  @RequestTimeoutMs(110_000)
  analyze(@Param('id') id: string, @Body() dto: AnalyzeCustomerCareConversationDto, @CurrentUser() user: any) {
    return this.orchestrator.analyze(id, uid(user), dto)
  }

  @Get('ai/config')
  configDetail() { return this.config.getOrCreate() }

  @Patch('ai/config')
  updateConfig(@Body() dto: UpdateCustomerCareAiConfigDto) { return this.config.update(dto) }

  @Get('ai/health')
  aiHealth() { return this.health.check() }

  @Get('ai/metrics')
  aiMetrics() { return this.metrics.getSnapshot() }

  @Get('ai/jobs/:jobId')
  job(@Param('jobId') jobId: string) { return this.orchestrator.getJob(jobId) }

  @Get('conversations/:id/ai/actions')
  actionsForConversation(@Param('id') id: string) { return this.actions.list(id) }

  @Post('ai/actions/:actionId/approve')
  approveAction(@Param('actionId') actionId: string, @Body() dto: CustomerCareAiActionDecisionDto, @CurrentUser() user: any) {
    return this.actions.approve(actionId, uid(user), dto.reason)
  }

  @Post('ai/actions/:actionId/reject')
  rejectAction(@Param('actionId') actionId: string, @Body() dto: CustomerCareAiActionDecisionDto, @CurrentUser() user: any) {
    return this.actions.reject(actionId, uid(user), dto.reason)
  }

  @Post('ai/results/:resultId/feedback')
  addFeedback(@Param('resultId') resultId: string, @Body() dto: CustomerCareAiFeedbackDto, @CurrentUser() user: any) {
    return this.feedback.add(resultId, uid(user), dto)
  }
}
