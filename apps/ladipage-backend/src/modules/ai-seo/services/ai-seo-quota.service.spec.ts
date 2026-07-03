import { HttpException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AiSeoQuotaService } from './ai-seo-quota.service'

describe('AiSeoQuotaService', () => {
  it('throws 429 when daily quota is exceeded', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'AI_SEO_DATAFORSEO_DAILY_QUOTA' ? '1' : undefined)),
    } as unknown as ConfigService

    const service = new AiSeoQuotaService(config)
    service.assertAvailable(99)
    expect(() => service.assertAvailable(99)).toThrow(HttpException)
  })

  it('skips quota check when limit is unset', () => {
    const config = { get: jest.fn(() => undefined) } as unknown as ConfigService
    const service = new AiSeoQuotaService(config)
    expect(() => service.assertAvailable(1)).not.toThrow()
  })
})