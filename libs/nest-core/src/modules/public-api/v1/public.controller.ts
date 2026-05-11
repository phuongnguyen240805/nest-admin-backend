import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common'
import { ApiHeader, ApiTags } from '@nestjs/swagger'
import { PublicApiGuard } from '../guards/public-api.guard'
import { PublicApiService } from '../public-api.service'

@ApiTags('Public API (Headless)')
@Controller('public-api/v1')
@UseGuards(PublicApiGuard) // Bảo vệ bằng API Key
@ApiHeader({ name: 'x-api-key', required: true })
export class PublicController {
  constructor(private readonly publicApiService: PublicApiService) {}

  // ====================== SYNC ======================
  @Post('sync/team')
  @HttpCode(200)
  async syncTeam(@Body() body: any) {
    return this.publicApiService.syncTeamMembers(body)
  }

  @Post('sync/usage')
  @HttpCode(200)
  async syncUsage(@Body() body: any) {
    return this.publicApiService.syncUsage(body)
  }

  // ====================== QUOTA ======================
  @Post('check-quota')
  @HttpCode(200)
  async checkQuota(@Body() body: { app: string, action: string, amount?: number }) {
    return this.publicApiService.checkQuota(body)
  }

  // ====================== WEBHOOK ======================
  @Post('webhook/event')
  @HttpCode(200)
  async webhookEvent(@Body() body: any) {
    return this.publicApiService.handleWebhookEvent(body)
  }

  // ====================== HEADLESS OPERATIONS ======================
  @Post('postiz/schedule')
  async schedulePost(@Body() body: any) {
    return this.publicApiService.schedulePost(body)
  }

  @Post('waoowaoo/render')
  async renderVideo(@Body() body: any) {
    return this.publicApiService.renderVideo(body)
  }

  @Post('opencut/export')
  async exportProject(@Body() body: any) {
    return this.publicApiService.exportProject(body)
  }
}
