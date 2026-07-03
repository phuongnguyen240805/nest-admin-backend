import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { KeywordResearchDto } from '../dto/keyword-research.dto'
import { SeoKeywordCacheEntity } from '../entities'
import { AiSeoCacheService } from './ai-seo-cache.service'
import { AiSeoQuotaService } from './ai-seo-quota.service'
import { OpenSeoClientService } from './openseo-client.service'

@Injectable()
export class AiSeoKeywordsService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(SeoKeywordCacheEntity)
    private readonly cacheRepository: Repository<SeoKeywordCacheEntity>,
    private readonly openSeoClient: OpenSeoClientService,
    private readonly cacheService: AiSeoCacheService,
    private readonly quotaService: AiSeoQuotaService,
  ) {
    super(tenantContext)
  }

  async research(dto: KeywordResearchDto) {
    const tenantId = this.requireTenantId()
    this.quotaService.assertAvailable(tenantId)

    const seedHash = this.cacheService.buildSeedHash(dto)
    const memoryKey = `seo:kw:${tenantId}:${seedHash}`
    const cached = this.cacheService.get<Record<string, unknown>>(memoryKey)
    if (cached) return cached

    const dbCached = await this.cacheRepository.findOne({
      where: { tenantId, seedHash },
    })
    if (dbCached && dbCached.expiresAt > new Date()) {
      this.cacheService.set(memoryKey, dbCached.response, 3600)
      return dbCached.response
    }

    const result = await this.openSeoClient.researchKeywords(dto)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await this.cacheRepository.upsert(
      {
        tenantId,
        seedHash,
        response: result,
        expiresAt,
      },
      ['tenantId', 'seedHash'],
    )

    this.cacheService.set(memoryKey, result, 24 * 3600)
    return result
  }

  async listSaved(projectId?: string) {
    if (!projectId) return { keywords: [] }
    return this.openSeoClient.callMcpTool('list_saved_keywords', { projectId })
  }
}