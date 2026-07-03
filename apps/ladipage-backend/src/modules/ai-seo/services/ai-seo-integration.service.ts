import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { TenantContextService } from '@liora/nest-core'
import { Repository } from 'typeorm'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { SeoIntegrationEntity, SeoIntegrationProvider, SeoProjectEntity } from '../entities'

@Injectable()
export class AiSeoIntegrationService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(SeoProjectEntity)
    private readonly projectRepository: Repository<SeoProjectEntity>,
    @InjectRepository(SeoIntegrationEntity)
    private readonly integrationRepository: Repository<SeoIntegrationEntity>,
    private readonly configService: ConfigService,
  ) {
    super(tenantContext)
  }

  async getGoogleConnectUrl(provider: 'gsc' | 'gbp', projectId: string) {
    const project = await this.assertProject(projectId)
    const baseUrl = this.configService.get<string>('OPENSEO_BASE_URL') ?? 'http://openseo:7003'
    return {
      provider,
      projectId: project.id,
      url: `${baseUrl.replace(/\/$/, '')}/integrations/google/${provider}/connect?projectId=${encodeURIComponent(project.openseoProjectId ?? project.id)}`,
    }
  }

  async handleGoogleCallback(provider: 'gsc' | 'gbp', query: Record<string, unknown>) {
    const tenantId = this.requireTenantId()
    const projectId = String(query.projectId ?? '')
    if (projectId) await this.assertProject(projectId)

    await this.integrationRepository.upsert(
      {
        tenantId,
        provider: provider as SeoIntegrationProvider,
        encryptedCredentials: {
          callbackReceivedAt: new Date().toISOString(),
          code: query.code ?? null,
          state: query.state ?? null,
        },
      },
      ['tenantId', 'provider'],
    )

    return { ok: true, provider, projectId: projectId || null }
  }

  private async assertProject(id: string) {
    const project = await this.projectRepository.findOne({
      where: {
        id,
        tenantId: this.requireTenantId(),
      },
    })
    if (!project) throw new NotFoundException('SEO project not found')
    return project
  }
}
