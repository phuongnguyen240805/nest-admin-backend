import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'

import { Bypass, Public } from '@liora/nest-core'

import { McpToolCallDto } from './dto/mcp-tool-call.dto'
import { McpApiKeyGuard, type McpAuthenticatedRequest } from './mcp-api-key.guard'
import { McpLandingService } from './mcp-landing.service'

@ApiTags('MCP Landing')
@ApiBearerAuth()
@SkipThrottle()
@Public()
@Bypass()
@UseGuards(McpApiKeyGuard)
@Controller('mcp/landing')
export class McpLandingController {
  constructor(private readonly mcpLandingService: McpLandingService) {}

  @Get('tools')
  listTools(@Req() request: McpAuthenticatedRequest) {
    return this.mcpLandingService.listTools(this.requireAuth(request))
  }

  @Post('tools/call')
  callTool(@Body() dto: McpToolCallDto, @Req() request: McpAuthenticatedRequest) {
    return this.mcpLandingService.callTool(
      dto.name,
      dto.arguments ?? {},
      this.requireAuth(request),
    )
  }

  private requireAuth(request: McpAuthenticatedRequest) {
    if (!request.mcpApiKey) {
      throw new Error('MCP API key guard did not attach auth context')
    }
    return request.mcpApiKey
  }
}
