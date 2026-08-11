import { Inject, Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'

import { AI_PROVIDER_GATEWAY, type AiProviderGateway } from '@liora/ai-gateway'

@Injectable()
export class CustomerCareAiHealthService {
  constructor(
    @Inject(AI_PROVIDER_GATEWAY) private readonly gateway: AiProviderGateway,
    private readonly dataSource: DataSource,
  ) {}

  async check() {
    const startedAt = Date.now()
    const [gateway, database] = await Promise.all([
      this.gateway.healthCheck().catch((error) => ({
        ok: false as const,
        gateway: 'omniroute' as const,
        availableCapabilities: [],
        errorCode: error instanceof Error ? error.name : 'AI_GATEWAY_ERROR',
      })),
      this.dataSource.query('SELECT 1 AS ok').then(() => ({ ok: true })).catch((error) => ({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })),
    ])
    return {
      ok: gateway.ok && database.ok,
      gateway,
      database,
      automation: {
        globallyEnabled: process.env.CUSTOMER_CARE_AI_AUTOMATION_ENABLED === 'true',
        autoActionsEnabled: false,
      },
      latencyMs: Date.now() - startedAt,
    }
  }
}
