import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

import { CloudflareSaasService } from './cloudflare-saas.service'

type CreateHostnameBody = {
  hostname?: string
  name?: string
}

/**
 * Nest control-plane endpoints for customer domain (structure.md P1).
 * FE BFF still owns Supabase landing_domains rows; these APIs create/check CF hostnames + flags.
 */
@ApiTags('Landing Domains (CF SaaS)')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('landing-domains')
export class LandingDomainController {
  constructor(private readonly cloudflareSaas: CloudflareSaasService) {}

  @Get('edge-flags')
  @ApiOperation({ summary: 'Domain edge feature flags (free + custom)' })
  edgeFlags() {
    return this.cloudflareSaas.getEdgeFlags()
  }

  @Post('custom-hostnames')
  @ApiOperation({ summary: 'Create Cloudflare Custom Hostname (or local stub)' })
  createHostname(@Body() body: CreateHostnameBody) {
    const hostname = body.hostname ?? body.name ?? ''
    return this.cloudflareSaas.createCustomHostname(hostname)
  }

  @Get('custom-hostnames/:id')
  @ApiOperation({ summary: 'Get Custom Hostname status' })
  getHostname(@Param('id') id: string) {
    return this.cloudflareSaas.getCustomHostname(id)
  }

  @Delete('custom-hostnames/:id')
  @ApiOperation({ summary: 'Delete Custom Hostname' })
  deleteHostname(@Param('id') id: string) {
    return this.cloudflareSaas.deleteCustomHostname(id)
  }
}
