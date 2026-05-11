import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import { AgentController } from './agent.controller'
import { Agent } from './entities/agent.entity'
import { AgentGraphInsertService } from './services/agent.graph.insert.service'
import { AgentGraphService } from './services/agent.graph.service'
import { AgentService } from './services/agent.service'

@Module({
  imports: [TypeOrmModule.forFeature([Agent]), AuthModule],
  controllers: [AgentController],
  providers: [
    AgentService,
    AgentGraphService,
    AgentGraphInsertService,
  ],
  exports: [AgentService, AgentGraphService],
})
export class AgentModule {}
