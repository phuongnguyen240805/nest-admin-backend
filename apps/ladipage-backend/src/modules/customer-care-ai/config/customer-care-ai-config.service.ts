import { ForbiddenException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { TenantContextService } from '@liora/nest-core'

import { CustomerCareAiTenantConfigEntity } from '../entities'
import { CUSTOMER_CARE_PROMPT_VERSION } from '../prompts/customer-care-system.prompt'

export interface UpdateCustomerCareAiConfigInput {
  enabled?: boolean
  mode?: 'copilot' | 'autopilot'
  model?: string | null
  temperature?: number
  maxOutputTokens?: number
  autoReplyEnabled?: boolean
}

@Injectable()
export class CustomerCareAiConfigService {
  constructor(
    private readonly tenantContext: TenantContextService,
    @InjectRepository(CustomerCareAiTenantConfigEntity)
    private readonly configs: Repository<CustomerCareAiTenantConfigEntity>,
  ) {}

  async getOrCreate() {
    const tenantId = this.requireTenantId()
    let row = await this.configs.findOne({ where: { tenantId } })
    if (row) return row
    const automationEnabled = process.env.CUSTOMER_CARE_AI_AUTOMATION_ENABLED === 'true'
    row = this.configs.create({
      tenantId,
      enabled: process.env.CUSTOMER_CARE_AI_ENABLED !== 'false',
      mode: automationEnabled ? 'autopilot' : 'copilot',
      // CUSTOMER_CARE_AI_MODEL may be an ordered, semicolon-delimited fallback
      // chain. Persist only the primary model because tenant config stores one
      // preferred model; the orchestrator reads the remaining global fallbacks
      // directly from the environment.
      model: this.primaryEnvModel(),
      temperature: Number(process.env.CUSTOMER_CARE_AI_TEMPERATURE ?? 0.2),
      maxOutputTokens: Number(process.env.CUSTOMER_CARE_AI_MAX_OUTPUT_TOKENS ?? 1200),
      promptVersion: CUSTOMER_CARE_PROMPT_VERSION,
      dailyBudget: null,
      autoReplyEnabled: automationEnabled,
      autoActionEnabled: false,
    })
    try {
      return await this.configs.save(row)
    } catch (error: any) {
      // Multiple backend replicas can receive the first message for a tenant
      // concurrently. Reuse the row created by the winning replica.
      if (error?.code === '23505') {
        const existing = await this.configs.findOne({ where: { tenantId } })
        if (existing) return existing
      }
      throw error
    }
  }

  async update(input: UpdateCustomerCareAiConfigInput) {
    const row = await this.getOrCreate()
    if (input.enabled !== undefined) row.enabled = input.enabled
    if (input.mode !== undefined) row.mode = input.mode
    if (input.model !== undefined) row.model = input.model?.trim() || null
    if (input.temperature !== undefined) row.temperature = input.temperature
    if (input.maxOutputTokens !== undefined) row.maxOutputTokens = input.maxOutputTokens
    if (input.autoReplyEnabled !== undefined) {
      row.autoReplyEnabled = input.autoReplyEnabled
      if (input.autoReplyEnabled) row.mode = 'autopilot'
    }
    if (row.mode !== 'autopilot') row.autoReplyEnabled = false
    // Auto actions deliberately remain disabled until a separately reviewed policy is implemented.
    row.autoActionEnabled = false
    row.promptVersion = CUSTOMER_CARE_PROMPT_VERSION
    return this.configs.save(row)
  }

  private requireTenantId() {
    const tenantId = this.tenantContext.getTenantId()
    if (tenantId == null) throw new ForbiddenException('Tenant ID is required')
    return tenantId
  }

  private primaryEnvModel(): string | null {
    return (process.env.CUSTOMER_CARE_AI_MODEL ?? '')
      .split(';')
      .map((model) => model.trim())
      .find(Boolean) ?? null
  }
}
