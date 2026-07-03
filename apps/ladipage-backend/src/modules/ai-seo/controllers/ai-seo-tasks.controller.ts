import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

import { SeoTaskActionDto } from '../dto/seo-task-action.dto'
import { UpdateSeoTaskDto } from '../dto/update-seo-task.dto'
import { AiSeoLandingPageService } from '../services/ai-seo-landing-page.service'
import { AiSeoTaskService } from '../services/ai-seo-task.service'

@ApiTags('AI SEO - Tasks')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ai-seo')
export class AiSeoTasksController {
  constructor(
    private readonly taskService: AiSeoTaskService,
    private readonly landingPageService: AiSeoLandingPageService,
  ) {}

  @Get('seo-projects/:id/tasks')
  listSeoProjectTasks(@Param('id') id: string) {
    return this.taskService.listForProject(id)
  }

  @Get('projects/:id/landing-pages/:pageId/tasks')
  listLandingPageTasks(
    @Param('id') id: string,
    @Param('pageId') pageId: string,
  ) {
    return this.landingPageService.tasks(id, pageId)
  }

  @Patch('seo-tasks/:id/approve')
  approvePatch(@Param('id') id: string, @Body() dto: SeoTaskActionDto) {
    return this.taskService.approve(id, dto)
  }

  @Post('seo-tasks/:id/approve')
  approvePost(@Param('id') id: string, @Body() dto: SeoTaskActionDto) {
    return this.taskService.approve(id, dto)
  }

  @Patch('seo-tasks/:id/reject')
  rejectPatch(@Param('id') id: string, @Body() dto: SeoTaskActionDto) {
    return this.taskService.reject(id, dto)
  }

  @Post('seo-tasks/:id/reject')
  rejectPost(@Param('id') id: string, @Body() dto: SeoTaskActionDto) {
    return this.taskService.reject(id, dto)
  }

  @Post('seo-tasks/:id/deploy')
  deploy(@Param('id') id: string, @Body() dto: SeoTaskActionDto) {
    return this.taskService.deploy(id, dto)
  }

  @Patch('seo-tasks/:id')
  update(@Param('id') id: string, @Body() dto: UpdateSeoTaskDto) {
    return this.taskService.updateFeStatus(id, dto.status)
  }
}