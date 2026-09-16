import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'

@Injectable()
export class AiSeoQuotaService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Atomically charges a weighted daily tenant quota in Postgres.
   * A zero/negative configured limit keeps the legacy unlimited behaviour.
   */
  async assertAvailable(tenantId: number, cost = 1): Promise<void> {
    const limit = Number(this.configService.get<string>('AI_SEO_DATAFORSEO_DAILY_QUOTA') ?? 0)
    if (!Number.isFinite(limit) || limit <= 0) return

    const normalizedCost = Math.max(1, Math.trunc(Number(cost) || 1))
    const day = new Date().toISOString().slice(0, 10)

    const rows = await this.dataSource.query(
      `INSERT INTO lp_ai_usage_quota_daily (tenant_id, usage_day, used_units, updated_at)
       SELECT $1, $2::date, $3, NOW()
       WHERE $3 <= $4
       ON CONFLICT (tenant_id, usage_day)
       DO UPDATE SET
         used_units = lp_ai_usage_quota_daily.used_units + EXCLUDED.used_units,
         updated_at = NOW()
       WHERE lp_ai_usage_quota_daily.used_units + EXCLUDED.used_units <= $4
       RETURNING used_units`,
      [tenantId, day, normalizedCost, Math.trunc(limit)],
    )

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new HttpException(
        {
          upgrade: true,
          message: 'AI SEO quota exceeded. Upgrade plan or connect a tenant DataForSEO key.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
  }
}
