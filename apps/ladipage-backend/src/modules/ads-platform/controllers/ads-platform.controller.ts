import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH, CurrentUser, TenantContextService, TenantGuard } from '@liora/nest-core'
import {
  definePermission,
  Perm,
} from '@liora/nest-core/modules/auth/decorators/permission.decorator'
import { ADS_PROVIDERS, type AdsProvider } from '@liora/ads-contracts'

import {
  CreateAdsPublishJobDto,
  CreateAdsExtensionSessionDto,
  CreateAdsSyncJobDto,
  ListAdsSnapshotsDto,
  StartAdsOAuthDto,
} from '../dto/ads-platform.dto'
import { AdsProviderRegistry } from '../core/ads-provider-registry.service'
import { AdsConnectionService } from '../services/ads-connection.service'
import { AdsExtensionSessionService } from '../services/ads-extension-session.service'
import { AdsJobService } from '../services/ads-job.service'
import { AdsSnapshotService } from '../services/ads-snapshot.service'

const ADS_PERMISSIONS = definePermission('ads', {
  READ: 'read',
  CONNECTION_MANAGE: 'connection:manage',
  SYNC: 'sync',
  PUBLISH: 'publish',
  ACTION: 'action',
} as const)

@ApiTags('Ads Platform')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ads-platform')
export class AdsPlatformController {
  constructor(
    private readonly registry: AdsProviderRegistry,
    private readonly connections: AdsConnectionService,
    private readonly jobs: AdsJobService,
    private readonly extensionSessions: AdsExtensionSessionService,
    private readonly snapshots: AdsSnapshotService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get('providers')
  @Perm(ADS_PERMISSIONS.READ)
  listProviders() {
    return this.registry.list()
  }

  @Get('connections')
  @Perm(ADS_PERMISSIONS.READ)
  listConnections() {
    return this.connections.listConnections()
  }

  @Post('connections/:provider/oauth/start')
  @Perm(ADS_PERMISSIONS.CONNECTION_MANAGE)
  startOAuth(
    @Param('provider') providerParam: string,
    @Body() dto: StartAdsOAuthDto,
    @CurrentUser() user: Record<string, unknown>,
  ) {
    return this.connections.startOAuth(this.provider(providerParam), this.actorId(user), dto.returnTo)
  }

  @Delete('connections/:connectionId')
  @Perm(ADS_PERMISSIONS.CONNECTION_MANAGE)
  disconnect(
    @Param('connectionId') connectionId: string,
    @CurrentUser() user: Record<string, unknown>,
  ) {
    return this.connections.disconnect(connectionId, this.actorId(user))
  }

  @Post('connections/:connectionId/discover-accounts')
  @Perm(ADS_PERMISSIONS.SYNC)
  discoverAccounts(
    @Param('connectionId') connectionId: string,
    @CurrentUser() user: Record<string, unknown>,
  ) {
    return this.connections.discoverAccounts(connectionId, this.actorId(user))
  }

  @Get('accounts')
  @Perm(ADS_PERMISSIONS.READ)
  listAccounts(@Query('connectionId') connectionId?: string) {
    return this.connections.listAccounts(connectionId)
  }

  @Post('jobs/sync')
  @Perm(ADS_PERMISSIONS.SYNC)
  createSyncJob(
    @Body() dto: CreateAdsSyncJobDto,
    @CurrentUser() user: Record<string, unknown>,
  ) {
    return this.jobs.createSyncJob(dto, this.actorId(user))
  }

  @Post('jobs/publish')
  @Perm(ADS_PERMISSIONS.PUBLISH)
  createPublishJob(
    @Body() dto: CreateAdsPublishJobDto,
    @CurrentUser() user: Record<string, unknown>,
  ) {
    return this.jobs.createPublishJob(dto, this.actorId(user))
  }

  @Get('jobs/:jobId')
  @Perm(ADS_PERMISSIONS.READ)
  getJob(@Param('jobId') jobId: string) {
    return this.jobs.getJob(jobId)
  }

  @Post('extension/sessions')
  @Perm(ADS_PERMISSIONS.SYNC)
  createExtensionSession(
    @Body() dto: CreateAdsExtensionSessionDto,
    @CurrentUser() user: Record<string, unknown>,
  ) {
    return this.extensionSessions.issue({
      tenantId: this.requireTenantId(),
      actorId: this.actorId(user),
      deviceId: dto.deviceId,
    })
  }

  @Get('snapshots')
  @Perm(ADS_PERMISSIONS.READ)
  listSnapshots(@Query() query: ListAdsSnapshotsDto) {
    return this.snapshots.listLatest(
      this.requireTenantId(),
      query.provider,
      query.externalAccountId,
      query.limit,
    )
  }

  private provider(value: string): AdsProvider {
    const normalized = value.toUpperCase() as AdsProvider
    if (!ADS_PROVIDERS.includes(normalized)) {
      throw new BadRequestException(`Unsupported ads provider ${value}`)
    }
    return normalized
  }

  private actorId(user: Record<string, unknown> | undefined): string {
    return String(user?.id ?? user?.uid ?? user?.userId ?? '')
  }

  private requireTenantId(): number {
    const tenantId = this.tenantContext.getTenantId()
    if (tenantId == null) throw new BadRequestException('Tenant context is required')
    return tenantId
  }
}
