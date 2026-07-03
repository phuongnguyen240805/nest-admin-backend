import { ConfigService } from '@nestjs/config'

import { OpenSeoClientService } from './openseo-client.service'

describe('OpenSeoClientService', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'OPENSEO_MCP_URL') return 'http://openseo.test/mcp'
      return undefined
    }),
  } as unknown as ConfigService

  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('calls MCP tools through the streamable HTTP tools/call envelope', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        result: {
          structuredContent: { ok: true },
        },
      }),
    })

    const service = new OpenSeoClientService(config)
    const result = await service.callMcpTool('whoami', {})

    expect(result).toEqual({ ok: true })
    expect(global.fetch).toHaveBeenCalledWith(
      'http://openseo.test/mcp',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"tools/call"'),
      }),
    )
  })
})
