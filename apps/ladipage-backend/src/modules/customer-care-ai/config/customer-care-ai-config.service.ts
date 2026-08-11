import { ForbiddenException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { TenantContextService } from '@liora/nest-core'

import { CustomerCareAiTenantConfigEntity } from '../entities'
import { CUSTOMER_CARE_PROMPT_VERSION } from '../prompts/customer-care-system.prompt'

export interface UpdateCustomerCareAiConfigInput {
  enabled?: boolean
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
    row = this.configs.create({
      tenantId,
      enabled: process.env.CUSTOMER_CARE_AI_ENABLED !== 'false',
      mode: 'copilot',
      model: process.env.CUSTOMER_CARE_AI_MODEL ?? null,
      temperature: Number(process.env.CUSTOMER_CARE_AI_TEMPERATURE ?? 0.2),
      maxOutputTokens: Number(process.env.CUSTOMER_CARE_AI_MAX_OUTPUT_TOKENS ?? 1200),
      promptVersion: CUSTOMER_CARE_PROMPT_VERSION,
      dailyBudget: null,
      autoReplyEnabled: false,
      autoActionEnabled: false,
    })
    return this.configs.save(row)
  }

  async update(input: UpdateCustomerCareAiConfigInput) {
    const row = await this.getOrCreate()
    if (input.enabled !== undefined) row.enabled = input.enabled
    if (input.model !== undefined) row.model = input.model?.trim() || null
    if (input.temperature !== undefined) row.temperature = input.temperature
    if (input.maxOutputTokens !== undefined) row.maxOutputTokens = input.maxOutputTokens
    if (input.autoReplyEnabled !== undefined) row.autoReplyEnabled = input.autoReplyEnabled
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
}
