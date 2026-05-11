import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator'
import { AgentCategory } from '../entities/agent.entity'

export class CreateAgentDto {
  @IsString()
  name: string

  @IsEnum(AgentCategory)
  category: AgentCategory

  @IsArray()
  @IsOptional()
  topics?: string[]

  @IsOptional()
  graphJson?: any

  @IsString()
  @IsOptional()
  description?: string

  @IsBoolean()
  @IsOptional()
  isActive?: boolean
}
