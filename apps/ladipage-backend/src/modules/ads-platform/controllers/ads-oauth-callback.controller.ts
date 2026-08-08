import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { Public } from '@liora/nest-core'
import { ADS_PROVIDERS, type AdsProvider } from '@liora/ads-contracts'

import { AdsConnectionService } from '../services/ads-connection.service'

@ApiTags('Ads Platform OAuth')
@Controller('ads-platform/connections')
export class AdsOAuthCallbackController {
  constructor(private readonly connections: AdsConnectionService) {}

  @Public()
  @Get(':provider/oauth/callback')
  callback(
    @Param('provider') providerParam: string,
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    if (!code?.trim() || !state?.trim()) {
      throw new BadRequestException('OAuth code and state are required')
    }
    const provider = providerParam.toUpperCase() as AdsProvider
    if (!ADS_PROVIDERS.includes(provider)) {
      throw new BadRequestException(`Unsupported ads provider ${providerParam}`)
    }
    return this.connections.completeOAuth(provider, code, state)
  }
}
