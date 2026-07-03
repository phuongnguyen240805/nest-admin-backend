import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { KeywordResearchDto } from '../dto/keyword-research.dto'

export type OpenSeoProject = {
  id: string
  name?: string
  domain?: string
  [key: string]: unknown
}

export type AuditStatus = {
  status: string
  progress?: number
  [key: string]: unknown
}

type McpJsonResponse = {
  result?: unknown
  error?: { message?: string }
}

@Injectable()
export class OpenSeoClientService {
  constructor(private readonly configService: ConfigService) {}

  async healthCheck(): Promise<{ ok: boolean }> {
    try {
      await this.callMcpTool('whoami', {})
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }

  listProjects(): Promise<OpenSeoProject[]> {
    return this.callMcpTool<OpenSeoProject[]>('list_projects', {})
  }

  async createProject(input: { name: string; domain?: string }): Promise<OpenSeoProject> {
    try {
      return await this.callMcpTool<OpenSeoProject>('create_project', input)
    } catch {
      const result = await this.executeSkill('seo-project-setup', input)
      return this.coerceProject(result, input)
    }
  }

  startAudit(input: {
    projectId: string
    startUrl: string
    maxPages?: number
    lighthouseStrategy?: string
  }): Promise<{ auditId: string }> {
    return this.callMcpTool<{ auditId: string }>('start_audit', input)
  }

  getAuditStatus(auditId: string): Promise<AuditStatus> {
    return this.callMcpTool<AuditStatus>('get_audit_status', { auditId })
  }

  getAuditResults(projectId: string, auditId: string): Promise<Record<string, unknown>> {
    return this.callMcpTool<Record<string, unknown>>('get_audit_results', { projectId, auditId })
  }

  getAuditLighthouseIssues(projectId: string, auditId: string): Promise<Record<string, unknown>> {
    return this.callMcpTool<Record<string, unknown>>('get_audit_lighthouse_issues', { projectId, auditId })
  }

  researchKeywords(input: KeywordResearchDto): Promise<Record<string, unknown>> {
    return this.callMcpTool<Record<string, unknown>>('research_keywords', input as unknown as Record<string, unknown>)
  }

  getKeywordMetrics(keywords: string[]): Promise<Record<string, unknown>> {
    return this.callMcpTool<Record<string, unknown>>('get_keyword_metrics', { keywords })
  }

  keywordResearchForPage(pageId: string, opts?: KeywordResearchDto): Promise<Record<string, unknown>> {
    return this.executeSkill('keyword-research', { pageId, ...(opts ?? {}) }) as Promise<Record<string, unknown>>
  }

  getSearchConsolePerformance(input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.callMcpTool<Record<string, unknown>>('get_search_console_performance', input)
  }

  inspectUrls(projectId: string, urls: string[]): Promise<Record<string, unknown>[]> {
    return this.callMcpTool<Record<string, unknown>[]>('inspect_urls', { projectId, urls })
  }

  async callMcpTool<T>(toolName: string, input: Record<string, unknown>): Promise<T> {
    const response = await this.postMcp({
      jsonrpc: '2.0',
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: input,
      },
    })

    const result = this.unwrapMcpResult(response.result)
    return result as T
  }

  executeSkill(skill: string, payload: Record<string, unknown>): Promise<unknown> {
    return this.callMcpTool('execute_skill', { skill, payload })
  }

  private async postMcp(payload: Record<string, unknown>): Promise<McpJsonResponse> {
    const response = await fetch(this.mcpUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).catch((error) => {
      throw new ServiceUnavailableException({
        message: `OpenSEO unavailable: ${error.message}`,
        retryAfter: 30,
      })
    })

    if (!response.ok) {
      throw new ServiceUnavailableException({
        message: `OpenSEO unavailable: HTTP ${response.status}`,
        retryAfter: 30,
      })
    }

    const raw = await response.text()
    const parsed = this.parseMcpResponse(raw)
    if (parsed.error) {
      throw new BadGatewayException(parsed.error.message ?? 'OpenSEO MCP tool failed')
    }
    return parsed
  }

  private parseMcpResponse(raw: string): McpJsonResponse {
    const trimmed = raw.trim()
    if (!trimmed) return {}

    if (trimmed.startsWith('data:')) {
      const dataLine = trimmed
        .split(/\r?\n/)
        .find((line) => line.startsWith('data:'))
      return JSON.parse(dataLine!.replace(/^data:\s*/, '')) as McpJsonResponse
    }

    return JSON.parse(trimmed) as McpJsonResponse
  }

  private unwrapMcpResult(result: unknown): unknown {
    if (!result || typeof result !== 'object') return result
    const record = result as Record<string, unknown>

    if (record.structuredContent) return record.structuredContent

    const content = record.content
    if (Array.isArray(content)) {
      const textItem = content.find((item) => typeof item?.text === 'string')
      if (textItem?.text) {
        try {
          return JSON.parse(textItem.text)
        } catch {
          return textItem.text
        }
      }
    }

    return result
  }

  private coerceProject(result: unknown, input: { name: string; domain?: string }): OpenSeoProject {
    const record = (result ?? {}) as Record<string, unknown>
    return {
      ...record,
      id: String(record.id ?? record.projectId ?? record.uuid ?? ''),
      name: String(record.name ?? input.name),
      domain: String(record.domain ?? input.domain ?? ''),
    }
  }

  private get mcpUrl(): string {
    const explicit = this.configService.get<string>('OPENSEO_MCP_URL')
    if (explicit) return explicit

    const baseUrl = this.configService.get<string>('OPENSEO_BASE_URL') ?? 'http://openseo:7003'
    return `${baseUrl.replace(/\/$/, '')}/mcp`
  }
}
