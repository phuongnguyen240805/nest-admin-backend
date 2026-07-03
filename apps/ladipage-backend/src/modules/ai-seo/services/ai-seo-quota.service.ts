import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

type QuotaBucket = {
  count: number
  resetAt: number
}

@Injectable()
export class AiSeoQuotaService {
  private readonly buckets = new Map<number, QuotaBucket>()

  constructor(private readonly configService: ConfigService) {}

  assertAvailable(tenantId: number, cost = 1): void {
    const limit = Number(this.configService.get<string>('AI_SEO_DATAFORSEO_DAILY_QUOTA') ?? 0)
    if (!Number.isFinite(limit) || limit <= 0) return

    const now = Date.now()
    const bucket = this.buckets.get(tenantId)
    const activeBucket = bucket && bucket.resetAt > now
      ? bucket
      : { count: 0, resetAt: now + 24 * 60 * 60 * 1000 }

    if (activeBucket.count + cost > limit) {
      throw new HttpException(
        {
          upgrade: true,
          message: 'AI SEO quota exceeded. Upgrade plan or connect a tenant DataForSEO key.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    activeBucket.count += cost
    this.buckets.set(tenantId, activeBucket)
  }
}
