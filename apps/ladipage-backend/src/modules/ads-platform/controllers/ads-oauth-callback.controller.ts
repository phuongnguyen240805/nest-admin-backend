import { BadRequestException, Controller, Get, Param, Query, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'

import { Public } from '@liora/nest-core'
import { ADS_PROVIDERS, type AdsProvider } from '@liora/ads-contracts'

import { AdsConnectionService } from '../services/ads-connection.service'

@ApiTags('Ads Platform OAuth')
@Controller('ads-platform/connections')
export class AdsOAuthCallbackController {
  constructor(private readonly connections: AdsConnectionService) {}

  @Public()
  @Get(':provider/oauth/callback')
  async callback(
    @Param('provider') providerParam: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') providerError: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    if (providerError) throw new BadRequestException(`Provider OAuth failed: ${providerError}`)
    if (!code?.trim() || !state?.trim()) {
      throw new BadRequestException('OAuth code and state are required')
    }
    const provider = providerParam.toUpperCase() as AdsProvider
    if (!ADS_PROVIDERS.includes(provider)) {
      throw new BadRequestException(`Unsupported ads provider ${providerParam}`)
    }
    const result = await this.connections.completeOAuth(provider, code, state)
    if (result.returnTo) {
      const separator = result.returnTo.includes('?') ? '&' : '?'
      return reply.redirect(
        `${result.returnTo}${separator}adsOAuth=success&provider=${encodeURIComponent(provider)}&connectionId=${encodeURIComponent(result.connectionId)}`,
      )
    }
    return result
  }
}
