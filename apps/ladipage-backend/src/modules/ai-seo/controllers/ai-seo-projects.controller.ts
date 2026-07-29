import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'

import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

import { CreateSeoProjectDto } from '../dto/create-seo-project.dto'
import { LinkLandingPageDto } from '../dto/link-landing-page.dto'
import { ListSeoDashboardProjectsQueryDto } from '../dto/list-seo-dashboard-projects-query.dto'
import { ListSeoProjectsQueryDto } from '../dto/list-seo-projects-query.dto'
import { ScanProjectDto } from '../dto/scan-project.dto'
import { UpdateSeoProjectDto } from '../dto/update-seo-project.dto'
import { AiSeoLandingPageService } from '../services/ai-seo-landing-page.service'
import { AiSeoProjectService } from '../services/ai-seo-project.service'
import { OpenSeoClientService } from '../services/openseo-client.service'

type FavoriteBody = {
  favorite?: boolean | string
}

@ApiTags('AI SEO - Projects')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ai-seo')
export class AiSeoProjectsController {
  constructor(
    private readonly projectService: AiSeoProjectService,
    private readonly landingPageService: AiSeoLandingPageService,
    private readonly openSeoClient: OpenSeoClientService,
  ) {}

  @Get('health')
  health() {
    return this.openSeoClient.healthCheck()
  }

  /**
   * Read-only dashboard projection. It deliberately uses persisted SEO/task/
   * traffic data and never starts a scan or provisions an Umami website.
   */
  @SkipThrottle()
  @Get('dashboard/projects')
  dashboardProjects(
    @Query() dto: ListSeoDashboardProjectsQueryDto,
    @Headers('store-id') storeId?: string,
  ) {
    return this.projectService.listDashboard(dto, storeId)
  }

  // Polled by the dashboard (list refetch 15s + one landing-pages poll per card);
  // read-only + tenant-scoped, so skip the 20/60s throttle to avoid 429 storms.
  @SkipThrottle()
  @Get('projects')
  list(
    @Query() dto: ListSeoProjectsQueryDto,
    @Headers('store-id') storeId?: string,
  ) {
    return this.projectService.list(dto, storeId)
  }

  @Post('projects')
  create(
    @Body() dto: CreateSeoProjectDto,
    @Headers('store-id') storeId?: string,
  ) {
    return this.projectService.create(dto, storeId)
  }

  @Get('projects/:id')
  detail(@Param('id') id: string) {
    return this.projectService.detail(id)
  }

  @Patch('projects/:id')
  update(@Param('id') id: string, @Body() dto: UpdateSeoProjectDto) {
    return this.projectService.update(id, dto)
  }

  @Delete('projects/:id')
  async remove(@Param('id') id: string) {
    await this.projectService.remove(id)
    return { success: true }
  }

  @Post('projects/:id/favorite')
  favorite(@Param('id') id: string, @Body() body: FavoriteBody) {
    return this.projectService.setFavorite(id, body.favorite === true || body.favorite === 'true')
  }

  @Patch('projects/:id/favorite')
  toggleFavorite(@Param('id') id: string) {
    return this.projectService.toggleFavorite(id)
  }

  @Post('projects/:id/scan')
  scan(@Param('id') id: string, @Body() dto: ScanProjectDto) {
    return this.projectService.scan(id, dto)
  }

  @SkipThrottle()
  @Get('projects/:id/agent-status')
  agentStatus(@Param('id') id: string) {
    return this.projectService.agentStatus(id)
  }

  @Patch('projects/:id/agent-status')
  toggleAgentStatus(@Param('id') id: string) {
    return this.projectService.toggleAgentStatus(id)
  }

  // Polled every 10s by each project card's stats — skip throttle (read-only, tenant-scoped).
  @SkipThrottle()
  @Get('projects/:id/landing-pages')
  landingPages(@Param('id') id: string) {
    return this.landingPageService.list(id)
  }

  @Post('projects/:id/landing-pages')
  linkLandingPage(@Param('id') id: string, @Body() dto: LinkLandingPageDto) {
    return this.landingPageService.link(id, dto)
  }

  @SkipThrottle()
  @Get('projects/:id/landing-pages/:pageId')
  landingPageDetail(
    @Param('id') id: string,
    @Param('pageId') pageId: string,
  ) {
    return this.landingPageService.detail(id, pageId)
  }

  @Delete('projects/:id/landing-pages/:pageId')
  async unlinkLandingPage(
    @Param('id') id: string,
    @Param('pageId') pageId: string,
  ) {
    await this.landingPageService.unlink(id, pageId)
    return { success: true }
  }

  @Post('projects/:id/landing-pages/:pageId/scan')
  scanLandingPage(
    @Param('id') id: string,
    @Param('pageId') pageId: string,
    @Body() dto: ScanProjectDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.landingPageService.scan(id, pageId, dto, authorization)
  }

  @SkipThrottle()
  @Get('projects/:id/landing-pages/:pageId/scores')
  landingPageScores(
    @Param('id') id: string,
    @Param('pageId') pageId: string,
  ) {
    return this.landingPageService.scores(id, pageId)
  }

  @Post('seo-projects')
  createSeoProject(
    @Body() dto: CreateSeoProjectDto,
    @Headers('store-id') storeId?: string,
  ) {
    return this.projectService.create(dto, storeId)
  }

  @Get('seo-projects/:id')
  seoProjectDetail(@Param('id') id: string) {
    return this.projectService.detail(id)
  }

  @Post('seo-projects/:id/setup')
  setupSeoProject(@Param('id') id: string, @Body() body?: Record<string, unknown>) {
    return this.projectService.setup(id, body)
  }

  @Patch('seo-projects/:id/setup')
  setupSeoProjectPatch(@Param('id') id: string, @Body() body?: Record<string, unknown>) {
    return this.projectService.setup(id, body)
  }

  @Post('seo-projects/:id/start-audit')
  startAudit(@Param('id') id: string, @Body() dto: ScanProjectDto) {
    return this.projectService.scan(id, dto)
  }

  @Get('seo-projects/:id/installation')
  installation(@Param('id') id: string) {
    return this.projectService.installation(id)
  }

  @Get('seo-projects/:id/installation/check')
  checkInstallation(@Param('id') id: string) {
    return this.projectService.checkInstallation(id)
  }

  @Post('seo-projects/:id/installation/check')
  checkInstallationPost(@Param('id') id: string) {
    return this.projectService.checkInstallation(id)
  }
}
