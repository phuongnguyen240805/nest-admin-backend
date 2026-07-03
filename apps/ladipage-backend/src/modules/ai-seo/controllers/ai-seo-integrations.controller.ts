import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

import { AiSeoIntegrationService } from '../services/ai-seo-integration.service'

@ApiTags('AI SEO - Integrations')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ai-seo/integrations/google')
export class AiSeoIntegrationsController {
  constructor(private readonly integrationService: AiSeoIntegrationService) {}

  @Get('gsc/connect-url')
  getGscConnectUrl(@Query('projectId') projectId: string) {
    return this.integrationService.getGoogleConnectUrl('gsc', projectId)
  }

  @Get('gbp/connect-url')
  getGbpConnectUrl(@Query('projectId') projectId: string) {
    return this.integrationService.getGoogleConnectUrl('gbp', projectId)
  }

  @Get('gsc/callback')
  gscCallback(@Query() query: Record<string, unknown>) {
    return this.integrationService.handleGoogleCallback('gsc', query)
  }

  @Get('gbp/callback')
  gbpCallback(@Query() query: Record<string, unknown>) {
    return this.integrationService.handleGoogleCallback('gbp', query)
  }
}
