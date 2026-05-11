import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { GetOrgFromRequest } from '~/libraries/nestjs_libraries/src/user/org.from.request'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { Organization } from '../billing/entities/organization.entity'
import { CreateAgentDto } from './dto/create-agent.dto'
import { AgentService } from './services/agent.service'

@ApiTags('Agent')
@ApiBearerAuth()
@Controller('agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post()
  create(@GetOrgFromRequest() org: Organization, @Body() dto: CreateAgentDto) {
    return this.agentService.createAgent(dto, org.id)
  }

  @Post(':id/execute')
  execute(@Param('id') id: string, @Body() input: any) {
    return this.agentService.executeAgent(id, input)
  }

  @Get()
  list(@GetOrgFromRequest() org: Organization) {
    return this.agentService.listAgents(org.id)
  }
}
