import { ConfigService } from '@nestjs/config'

import {
  UmamiAuthError,
  UmamiClientService,
  UmamiUnavailableError,
} from './umami-client.service'

describe('UmamiClientService', () => {
  const configValues: Record<string, string> = {
    UMAMI_ENABLED: 'true',
    UMAMI_BASE_URL: 'http://umami.test',
    UMAMI_API_KEY: 'test-key',
    UMAMI_TIMEOUT_MS: '3000',
    UMAMI_CIRCUIT_FAILURE_THRESHOLD: '3',
    UMAMI_CIRCUIT_OPEN_MS: '60000',
  }

  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService

  beforeEach(() => {
    global.fetch = jest.fn()
    jest.clearAllMocks()
    configValues.UMAMI_ENABLED = 'true'
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('is disabled when UMAMI_ENABLED is not true', () => {
    configValues.UMAMI_ENABLED = 'false'
    const service = new UmamiClientService(config)
    expect(service.isEnabled()).toBe(false)
  })

  it('getStats calls Umami REST with auth headers', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          pageviews: { value: 10 },
          visitors: { value: 4 },
          visits: { value: 5 },
          bounces: { value: 1 },
          totaltime: { value: 100 },
        }),
    })

    const service = new UmamiClientService(config)
    const stats = await service.getStats('web-1', { startAt: 1, endAt: 2 })

    expect(stats.pageviews).toBe(10)
    expect(stats.visitors).toBe(4)
    expect(global.fetch).toHaveBeenCalledWith(
      'http://umami.test/api/websites/web-1/stats?startAt=1&endAt=2',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          authorization: 'Bearer test-key',
          'x-umami-api-key': 'test-key',
        }),
      }),
    )
  })

  it('throws UmamiAuthError on 401', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '',
    })

    const service = new UmamiClientService(config)
    await expect(service.getWebsite('x')).rejects.toBeInstanceOf(UmamiAuthError)
  })

  it('opens circuit after consecutive failures and short-circuits', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '',
    })

    const service = new UmamiClientService(config)

    await expect(service.getWebsite('a')).rejects.toBeInstanceOf(UmamiUnavailableError)
    await expect(service.getWebsite('a')).rejects.toBeInstanceOf(UmamiUnavailableError)
    await expect(service.getWebsite('a')).rejects.toBeInstanceOf(UmamiUnavailableError)

    expect(service.getCircuitState()).toBe('open')

    ;(global.fetch as jest.Mock).mockClear()
    await expect(service.getWebsite('a')).rejects.toThrow(/circuit open/)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('createWebsite maps response id', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 'w-9', name: 'n', domain: 'd.com' }),
    })

    const service = new UmamiClientService(config)
    const website = await service.createWebsite({ name: 'n', domain: 'd.com' })
    expect(website.id).toBe('w-9')
  })
})
