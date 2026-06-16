import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { TenantGuard } from '@liora/nest-core'
import { UpdateIntegrationsSettingsDto } from './dto/update-integrations-settings.dto'
import { UpdateWorkspaceSettingsDto } from './dto/update-workspace-settings.dto'
import { SettingsService } from './settings.service'

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(TenantGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('workspace')
  @ApiOperation({ summary: 'Get workspace settings (name, logo, timezone)' })
  getWorkspace() {
    return this.settingsService.getWorkspaceSettings()
  }

  @Put('workspace')
  @ApiOperation({ summary: 'Update workspace settings' })
  updateWorkspace(@Body() dto: UpdateWorkspaceSettingsDto) {
    return this.settingsService.updateWorkspaceSettings(dto)
  }

  @Get('integrations')
  @ApiOperation({ summary: 'Get integration tokens (Facebook, Zalo)' })
  getIntegrations() {
    return this.settingsService.getIntegrationsSettings()
  }

  @Put('integrations')
  @ApiOperation({ summary: 'Save integration tokens (encrypted at rest)' })
  updateIntegrations(@Body() dto: UpdateIntegrationsSettingsDto) {
    return this.settingsService.updateIntegrationsSettings(dto)
  }
}