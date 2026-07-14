import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { TenantGuard } from '@liora/nest-core'
import { AuthUser } from '@liora/nest-core/modules/auth/decorators/auth-user.decorator'
import { ApiKeyService } from './api-key.service'
import { CreateApiKeyDto } from './dto/api-key.dto'
import { UpdateIntegrationsSettingsDto } from './dto/update-integrations-settings.dto'
import { UpdateWorkspaceSettingsDto } from './dto/update-workspace-settings.dto'
import { SettingsService } from './settings.service'

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(TenantGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

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

  @Get('api-keys')
  @ApiOperation({ summary: 'List MCP/API keys for the current workspace' })
  listApiKeys() {
    return this.apiKeyService.listApiKeys()
  }

  @Post('api-keys')
  @ApiOperation({ summary: 'Create an MCP/API key. The plaintext key is returned once.' })
  createApiKey(@Body() dto: CreateApiKeyDto, @AuthUser('uid') uid: number) {
    return this.apiKeyService.createApiKey(dto, uid)
  }

  @Post('api-keys/:id/revoke')
  @ApiOperation({ summary: 'Revoke an MCP/API key' })
  revokeApiKey(@Param('id', ParseIntPipe) id: number) {
    return this.apiKeyService.revokeApiKey(id)
  }

  @Post('api-keys/:id/rotate')
  @ApiOperation({ summary: 'Rotate an MCP/API key. The new plaintext key is returned once.' })
  rotateApiKey(@Param('id', ParseIntPipe) id: number) {
    return this.apiKeyService.rotateApiKey(id)
  }
}
