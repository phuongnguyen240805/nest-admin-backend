import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Agent } from '../entities/agent.entity'

@Injectable()
export class AgentGraphInsertService {
  constructor(
    @InjectRepository(Agent)
    private agentRepo: Repository<Agent>,
  ) {}

  async insertOrUpdate(agentData: Partial<Agent>) {
    let agent = await this.agentRepo.findOne({
      where: { name: agentData.name, organizationId: agentData.organizationId },
    })

    if (!agent) {
      agent = this.agentRepo.create(agentData)
    }
    else {
      Object.assign(agent, agentData)
    }

    return this.agentRepo.save(agent)
  }
}
