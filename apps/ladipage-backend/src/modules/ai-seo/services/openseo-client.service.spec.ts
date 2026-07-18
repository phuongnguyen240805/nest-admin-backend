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

  function mockJson(body: unknown) {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify(body),
    })
  }

  it('calls MCP tools through the streamable HTTP tools/call envelope', async () => {
    mockJson({
      result: {
        structuredContent: { ok: true },
      },
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

  it('listProjects unwraps structuredContent.projects', async () => {
    mockJson({
      result: {
        structuredContent: {
          projects: [
            { id: '834192fe-dfd2-4f79-9b54-a4c43fce5ad3', name: 'Default', domain: null },
          ],
        },
      },
    })

    const service = new OpenSeoClientService(config)
    const projects = await service.listProjects()
    expect(projects).toHaveLength(1)
    expect(projects[0].id).toBe('834192fe-dfd2-4f79-9b54-a4c43fce5ad3')
  })

  it('createProject binds Default project when create_project is missing', async () => {
    // create_project fails
    mockJson({
      error: { message: 'Tool create_project not found' },
    })
    // list_projects succeeds
    mockJson({
      result: {
        structuredContent: {
          projects: [
            { id: '834192fe-dfd2-4f79-9b54-a4c43fce5ad3', name: 'Default', domain: null },
          ],
        },
      },
    })

    const service = new OpenSeoClientService(config)
    const project = await service.createProject({ name: 'My site', domain: 'example.com' })

    expect(project.id).toBe('834192fe-dfd2-4f79-9b54-a4c43fce5ad3')
    expect(project.name).toBe('Default')
  })

  it('startAudit rejects local domains before calling OpenSEO', async () => {
    mockJson({
      error: { message: 'Tool start_audit not found' },
    })

    const service = new OpenSeoClientService(config)
    await expect(
      service.startAudit({
        projectId: '834192fe-dfd2-4f79-9b54-a4c43fce5ad3',
        startUrl: 'http://localhost:3000/p/demo',
      }),
    ).rejects.toThrow(/public domain|localhost|example\.com/i)

    // Only start_audit attempt — no get_domain_overview with invalid host
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('startAudit falls back to get_domain_overview and local audit cache', async () => {
    // start_audit missing
    mockJson({
      error: { message: 'Tool start_audit not found' },
    })
    // get_domain_overview
    mockJson({
      result: {
        structuredContent: {
          domain: 'example.com',
          organicTraffic: 1200,
          organicKeywords: 80,
          backlinks: 40,
          referringDomains: 12,
        },
      },
    })

    const service = new OpenSeoClientService(config)
    const { auditId } = await service.startAudit({
      projectId: '834192fe-dfd2-4f79-9b54-a4c43fce5ad3',
      startUrl: 'https://example.com',
    })

    expect(auditId).toMatch(/^domain-overview-/)

    const status = await service.getAuditStatus(auditId)
    expect(status.status).toBe('completed')
    expect(status.progress).toBe(100)

    const results = await service.getAuditResults(
      '834192fe-dfd2-4f79-9b54-a4c43fce5ad3',
      auditId,
    )
    expect(results.source).toBe('get_domain_overview')
    expect(results.domain).toBe('example.com')
    expect(results.scores).toBeDefined()
  })

  it('surfaces isError tool payloads as BadGatewayException', async () => {
    mockJson({
      result: {
        isError: true,
        content: [{ type: 'text', text: 'Missing DATAFORSEO_API_KEY' }],
      },
    })

    const service = new OpenSeoClientService(config)
    await expect(service.callMcpTool('get_domain_overview', {})).rejects.toThrow(
      /Missing DATAFORSEO_API_KEY/,
    )
  })
})
