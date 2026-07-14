import { Module } from '@nestjs/common'

import { LandingAiApiModule } from '../landing-ai/landing-ai-api.module'
import { SettingsModule } from '../settings/settings.module'
import { McpApiKeyGuard } from './mcp-api-key.guard'
import { McpLandingController } from './mcp-landing.controller'
import { McpLandingService } from './mcp-landing.service'

@Module({
  imports: [SettingsModule, LandingAiApiModule],
  controllers: [McpLandingController],
  providers: [McpApiKeyGuard, McpLandingService],
})
export class McpLandingModule {}
