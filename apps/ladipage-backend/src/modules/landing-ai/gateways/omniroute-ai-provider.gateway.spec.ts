import { OmniRouteAiProviderGateway } from './omniroute-ai-provider.gateway'

describe('OmniRouteAiProviderGateway', () => {
  const originalFetch = global.fetch
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      OMNIROUTE_BASE_URL: 'http://omniroute.local/v1',
      OMNIROUTE_API_KEY: 'secret-key',
    }
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  it('maps chat completion response and OmniRoute trace headers', async () => {
    const headers = new Headers({
      'X-OmniRoute-Provider': 'gemini-web2api',
      'X-OmniRoute-Model': 'gemini-auto',
      'X-OmniRoute-Tokens-In': '12',
      'X-OmniRoute-Tokens-Out': '34',
      'X-OmniRoute-Response-Cost': '0.001',
      'X-OmniRoute-Fallback-Attempts': '1',
    })
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'cmpl_1',
          choices: [{ message: { content: '<html>ok</html>' } }],
        }),
        { status: 200, headers },
      ),
    )

    const gateway = new OmniRouteAiProviderGateway()
    const result = await gateway.generateText({
      workspaceId: '1',
      invocationId: 'job-1',
      idempotencyKey: 'job-1',
      sessionId: 'org:page',
      capability: 'text',
      messages: [{ role: 'user', content: 'Build page' }],
    })

    expect(result.text).toBe('<html>ok</html>')
    expect(result.usage.inputTokens).toBe(12)
    expect(result.usage.outputTokens).toBe(34)
    expect(result.usage.estimatedCost).toBe(0.001)
    expect(result.trace.gateway).toBe('omniroute')
    expect(result.trace.provider).toBe('gemini-web2api')
    expect(result.trace.model).toBe('gemini-auto')
    expect(result.trace.fallbackAttempts).toBe(1)
    expect(global.fetch).toHaveBeenCalledWith(
      'http://omniroute.local/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-key',
          'Idempotency-Key': 'job-1',
          'X-Session-Id': 'org:page',
        }),
      }),
    )
  })

  it('requires OmniRoute API key', async () => {
    delete process.env.OMNIROUTE_API_KEY
    const gateway = new OmniRouteAiProviderGateway()

    await expect(gateway.generateText({
      workspaceId: '1',
      invocationId: 'job-1',
      capability: 'text',
      messages: [{ role: 'user', content: 'Build page' }],
    })).rejects.toThrow('OMNIROUTE_API_KEY is required')
  })
})
