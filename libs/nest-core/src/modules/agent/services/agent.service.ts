import { Injectable } from '@nestjs/common'
import { CreateAgentDto } from '../dto/create-agent.dto'
import { Agent } from '../entities/agent.entity'
import { AgentGraphInsertService } from './agent.graph.insert.service'
import { AgentGraphService } from './agent.graph.service'

@Injectable()
export class AgentService {
  constructor(
    private graphService: AgentGraphService,
    private insertService: AgentGraphInsertService,
  ) {}

  async createAgent(dto: CreateAgentDto, organizationId: string) {
    return this.insertService.insertOrUpdate({
      ...dto,
      organizationId,
    })
  }

  async executeAgent(agentId: string, input: any) {
    // Logic lấy agent rồi execute graph
    const result = await this.graphService.executeGraph({ id: agentId } as Agent, input)
    return result
  }

  async listAgents(organizationId: string) {
    // Implement repository query nếu cần
    return [] // placeholder
  }
}
