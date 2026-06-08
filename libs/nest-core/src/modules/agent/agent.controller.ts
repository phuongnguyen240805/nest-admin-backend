import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { LibrefangService } from '@liora/librefang-client'
import { GetOrgFromRequest } from '~/libraries/nestjs_libraries/src/user/org.from.request'
import { AuthUser } from '../auth/decorators/auth-user.decorator'
import { Perm, definePermission } from '../auth/decorators/permission.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RbacGuard } from '../auth/guards/rbac.guard'
import { IAuthUser } from '../auth/interfaces/auth.interface'
import { Organization } from '../billing/entities/organization.entity'
import { AgentChatDto } from './dto/agent-chat.dto'
import { CreateAgentDto } from './dto/create-agent.dto'
import { AgentService } from './services/agent.service'
import { mapRolesToCapabilities } from './utils/agent-capabilities.util'

export const AgentPermissions = definePermission('agent', {
  CHAT: 'chat',
})

@ApiTags('Agent')
@ApiBearerAuth()
@Controller(['agent', 'agents'])
@UseGuards(JwtAuthGuard, RbacGuard)
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly librefangService: LibrefangService,
  ) {}

  @Post()
  create(@GetOrgFromRequest() org: Organization, @Body() dto: CreateAgentDto) {
    return this.agentService.createAgent(dto, org.id)
  }

  @Post(':id/execute')
  execute(@Param('id') id: string, @Body() input: any) {
    return this.agentService.executeAgent(id, input)
  }

  @Post(':id/chat')
  @Perm(AgentPermissions.CHAT)
  @ApiOperation({ summary: 'Forward chat to LibreFang agent runtime' })
  async chatWithAgent(
    @Param('id') agentId: string,
    @Body() dto: AgentChatDto,
    @AuthUser() user: IAuthUser,
  ) {
    const capabilities = mapRolesToCapabilities(user.roles ?? [])
    return this.librefangService.sendToAgent(
      String(user.uid),
      agentId,
      dto.message,
      capabilities,
    )
  }

  @Get()
  list(@GetOrgFromRequest() org: Organization) {
    return this.agentService.listAgents(org.id)
  }
}
