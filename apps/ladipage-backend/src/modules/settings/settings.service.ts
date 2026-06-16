import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type {
  IntegrationsSettingsDto,
  WorkspaceSettingsDto,
} from '@liora/api-types'
import { Tenant, TenantContextService, aesDecrypt, aesEncrypt } from '@liora/nest-core'
import { UpdateIntegrationsSettingsDto } from './dto/update-integrations-settings.dto'
import { UpdateWorkspaceSettingsDto } from './dto/update-workspace-settings.dto'

interface TenantSettingsJson {
  workspace?: {
    timezone?: string
    locale?: string
    description?: string
  }
  integrations?: {
    facebook?: {
      token?: string
      pageId?: string
    }
    zalo?: {
      token?: string
      oaId?: string
    }
  }
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getWorkspaceSettings(): Promise<WorkspaceSettingsDto> {
    const tenant = await this.getCurrentTenant()
    const settings = this.getSettingsJson(tenant)

    return {
      name: tenant.name ?? '',
      logo: tenant.logo,
      timezone: settings.workspace?.timezone ?? 'Asia/Ho_Chi_Minh',
      locale: settings.workspace?.locale ?? 'vi',
      description: settings.workspace?.description,
    }
  }

  async updateWorkspaceSettings(dto: UpdateWorkspaceSettingsDto): Promise<WorkspaceSettingsDto> {
    const tenant = await this.getCurrentTenant()
    const settings = this.getSettingsJson(tenant)

    if (dto.name !== undefined)
      tenant.name = dto.name
    if (dto.logo !== undefined)
      tenant.logo = dto.logo

    settings.workspace = {
      ...settings.workspace,
      ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
      ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
    }

    tenant.settings = settings
    await this.tenantRepository.save(tenant)

    return this.getWorkspaceSettings()
  }

  async getIntegrationsSettings(): Promise<IntegrationsSettingsDto> {
    const tenant = await this.getCurrentTenant()
    const settings = this.getSettingsJson(tenant)
    const integrations = settings.integrations ?? {}

    return {
      facebook: this.mapFacebookIntegration(integrations.facebook),
      zalo: this.mapZaloIntegration(integrations.zalo),
    }
  }

  async updateIntegrationsSettings(
    dto: UpdateIntegrationsSettingsDto,
  ): Promise<IntegrationsSettingsDto> {
    const tenant = await this.getCurrentTenant()
    const settings = this.getSettingsJson(tenant)
    const integrations = settings.integrations ?? {}

    if (dto.facebook) {
      integrations.facebook = {
        pageId: dto.facebook.pageId ?? integrations.facebook?.pageId,
        token: dto.facebook.token
          ? aesEncrypt(dto.facebook.token)
          : integrations.facebook?.token,
      }
    }

    if (dto.zalo) {
      integrations.zalo = {
        oaId: dto.zalo.oaId ?? integrations.zalo?.oaId,
        token: dto.zalo.token
          ? aesEncrypt(dto.zalo.token)
          : integrations.zalo?.token,
      }
    }

    settings.integrations = integrations
    tenant.settings = settings
    await this.tenantRepository.save(tenant)

    return this.getIntegrationsSettings()
  }

  private async getCurrentTenant(): Promise<Tenant> {
    const tenantId = this.tenantContext.getTenantId()
    if (tenantId == null)
      throw new NotFoundException('Tenant context not found')

    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } })
    if (!tenant)
      throw new NotFoundException('Tenant not found')

    return tenant
  }

  private getSettingsJson(tenant: Tenant): TenantSettingsJson {
    return (tenant.settings ?? {}) as TenantSettingsJson
  }

  private mapFacebookIntegration(
    integration?: { token?: string; pageId?: string },
  ) {
    if (!integration)
      return { configured: false }

    return {
      pageId: integration.pageId,
      token: integration.token ? aesDecrypt(integration.token) : undefined,
      configured: Boolean(integration.token),
    }
  }

  private mapZaloIntegration(
    integration?: { token?: string; oaId?: string },
  ) {
    if (!integration)
      return { configured: false }

    return {
      oaId: integration.oaId,
      token: integration.token ? aesDecrypt(integration.token) : undefined,
      configured: Boolean(integration.token),
    }
  }
}