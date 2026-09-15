import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
  Req,
  UnprocessableEntityException,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

import { Public, TenantContextService } from '@liora/nest-core'

import { PublishService } from './publish.service'
import {
  PUBLISH_SIGNATURE_HEADER,
  PUBLISH_TIMESTAMP_HEADER,
  verifyPublishSignature,
} from './services/publish-signature'

type InternalAiSeoSyncBody = {
  tenantId?: number
  organizationId?: string | null
  pageId?: string
  html?: string | null
  publicUrl?: string | null
  hostname?: string | null
  name?: string | null
  slug?: string | null
}

type RawBodyRequest = FastifyRequest & { rawBody?: Buffer }

@Public()
@Controller('internal/publish')
export class InternalPublishController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly publishService: PublishService,
  ) {}

  @Post('ai-seo-sync')
  async aiSeoSync(
    @Req() request: RawBodyRequest,
    @Headers(PUBLISH_TIMESTAMP_HEADER) timestamp: string | undefined,
    @Headers(PUBLISH_SIGNATURE_HEADER) signature: string | undefined,
    @Body() body: InternalAiSeoSyncBody,
  ) {
    const secret = process.env.LANDING_PUBLISH_EXECUTOR_SECRET?.trim() ?? ''
    if (secret.length < 32) {
      throw new ForbiddenException('Internal publish authentication is not configured')
    }

    if (!request.rawBody) {
      throw new ForbiddenException('Raw request body is required for internal publish authentication')
    }
    const rawBody = request.rawBody.toString('utf8')
    if (!verifyPublishSignature({ secret, timestamp, signature, body: rawBody })) {
      throw new ForbiddenException('Invalid internal publish signature')
    }

    if (!Number.isInteger(body.tenantId) || Number(body.tenantId) <= 0 || !body.pageId?.trim()) {
      throw new UnprocessableEntityException('Invalid internal publish context')
    }

    this.tenantContext.setTenantId(Number(body.tenantId))
    if (body.organizationId?.trim()) {
      this.tenantContext.setOrganizationId(body.organizationId.trim())
    }

    return this.publishService.completeLandingPublish({
      pageId: body.pageId,
      html: body.html ?? null,
      ensureSeoProject: true,
      publicUrl: body.publicUrl ?? null,
      hostname: body.hostname ?? null,
      name: body.name ?? null,
      slug: body.slug ?? null,
    })
  }
}
