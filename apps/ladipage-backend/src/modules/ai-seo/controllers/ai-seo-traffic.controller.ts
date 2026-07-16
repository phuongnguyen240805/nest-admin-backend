import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiSecurity, ApiTags } from '@nestjs/swagger'

import { API_SECURITY_AUTH, TenantGuard } from '@liora/nest-core'

import {
  AiSeoTrafficService,
  TrafficMetricType,
  TrafficRange,
} from '../services/ai-seo-traffic.service'

@ApiTags('AI SEO - Traffic (Umami)')
@ApiSecurity(API_SECURITY_AUTH)
@UseGuards(TenantGuard)
@Controller('ai-seo')
export class AiSeoTrafficController {
  constructor(private readonly trafficService: AiSeoTrafficService) {}

  @Get('traffic/health')
  health() {
    return this.trafficService.health()
  }

  @Get('projects/:id/traffic')
  getTraffic(
    @Param('id') id: string,
    @Query('range') range?: string,
  ) {
    return this.trafficService.getProjectTraffic(id, this.parseRange(range))
  }

  @Get('projects/:id/traffic/metrics')
  getMetrics(
    @Param('id') id: string,
    @Query('type') type?: string,
    @Query('range') range?: string,
  ) {
    return this.trafficService.getProjectMetrics(
      id,
      this.parseMetricType(type),
      this.parseRange(range),
    )
  }

  @Get('projects/:id/traffic/timeseries')
  getTimeseries(
    @Param('id') id: string,
    @Query('range') range?: string,
  ) {
    return this.trafficService.getProjectTimeseries(id, this.parseRange(range))
  }

  @Post('projects/:id/traffic/provision')
  provision(@Param('id') id: string) {
    return this.trafficService.provisionForProject(id)
  }

  private parseRange(range?: string): TrafficRange {
    return range === '30d' ? '30d' : '7d'
  }

  private parseMetricType(type?: string): TrafficMetricType {
    const allowed: TrafficMetricType[] = ['referrer', 'url', 'device', 'country', 'event']
    if (type && (allowed as string[]).includes(type)) {
      return type as TrafficMetricType
    }
    return 'referrer'
  }
}
