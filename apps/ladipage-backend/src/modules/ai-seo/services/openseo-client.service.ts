import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'crypto'

import { KeywordResearchDto } from '../dto/keyword-research.dto'
import {
  extractHostname,
  isPublicRegistrableDomain,
  publicDomainErrorMessage,
} from '../utils/domain.util'

export type OpenSeoProject = {
  id: string
  name?: string
  domain?: string | null
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

type LocalScanRecord = {
  projectId: string
  domain: string
  status: 'completed' | 'failed'
  result: Record<string, unknown>
  createdAt: number
}

/**
 * OpenSEO MCP adapter (streamable HTTP tools/call).
 *
 * OpenSEO MCP v0.0.x (self-hosted) exposes research tools only:
 *   whoami, list_projects, research_keywords, get_domain_overview, ...
 * It does NOT expose create_project / start_audit / execute_skill / get_audit_*.
 *
 * We bind Liora projects to an existing OpenSEO project via list_projects,
 * and treat get_domain_overview as the scan/audit substitute.
 */
@Injectable()
export class OpenSeoClientService {
  /** In-process cache for domain-overview "audits" (single Nest process). */
  private readonly localScans = new Map<string, LocalScanRecord>()

  constructor(private readonly configService: ConfigService) {}

  async healthCheck(): Promise<{ ok: boolean }> {
    try {
      await this.callMcpTool('whoami', {})
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }

  async listProjects(): Promise<OpenSeoProject[]> {
    const result = await this.callMcpTool<unknown>('list_projects', {})
    return this.normalizeProjectList(result)
  }

  /**
   * Resolve / bind an OpenSEO project id for a Liora SEO project.
   * Real MCP has no create_project — match by domain, else first org project.
   */
  async createProject(input: { name: string; domain?: string }): Promise<OpenSeoProject> {
    // Future-proof: try create_project if a newer OpenSEO image adds it.
    try {
      const created = await this.callMcpTool<OpenSeoProject>('create_project', input)
      const id = this.extractProjectId(created)
      if (id) {
        return { ...created, id, name: created.name ?? input.name, domain: created.domain ?? input.domain ?? null }
      }
    } catch {
      // Expected on MCP v0.0.x — fall through to list_projects binding.
    }

    const projects = await this.listProjects()
    if (projects.length === 0) {
      throw new ServiceUnavailableException({
        message:
          'OpenSEO has no projects. Open OpenSEO UI once to create a Default project, then retry.',
        retryAfter: 30,
      })
    }

    const domain = this.normalizeDomain(input.domain ?? input.name)
    const byDomain = domain
      ? projects.find((p) => this.normalizeDomain(String(p.domain ?? '')) === domain)
      : undefined

    const matched = byDomain ?? projects.find((p) => /default/i.test(String(p.name ?? ''))) ?? projects[0]
    const id = this.extractProjectId(matched)
    if (!id) {
      throw new BadGatewayException('OpenSEO list_projects returned a project without id')
    }

    return {
      ...matched,
      id,
      name: matched.name ?? input.name,
      domain: matched.domain ?? input.domain ?? null,
    }
  }

  /**
   * Start a site scan.
   * Prefers start_audit when available; otherwise runs get_domain_overview
   * and returns a local auditId that getAuditStatus/Results understand.
   */
  async startAudit(input: {
    projectId: string
    startUrl: string
    maxPages?: number
    lighthouseStrategy?: string
  }): Promise<{ auditId: string }> {
    try {
      const result = await this.callMcpTool<{ auditId?: string; id?: string }>('start_audit', input)
      const auditId = String(result.auditId ?? result.id ?? '').trim()
      if (auditId) return { auditId }
    } catch {
      // Expected on MCP research-tools image — domain overview fallback.
    }

    const domain = this.domainFromUrl(input.startUrl)
    // OpenSEO validates with tldts — localhost / bare labels / UUIDs fail with
    // "Enter a valid domain like example.com". Fail fast with a clear message.
    if (!isPublicRegistrableDomain(domain)) {
      throw new BadGatewayException(publicDomainErrorMessage(domain))
    }

    const overview = await this.callMcpTool<Record<string, unknown>>('get_domain_overview', {
      projectId: input.projectId,
      domain,
      includeSubdomains: false,
    })

    const auditId = `domain-overview-${randomUUID()}`
    this.localScans.set(auditId, {
      projectId: input.projectId,
      domain,
      status: 'completed',
      result: {
        source: 'get_domain_overview',
        domain,
        startUrl: input.startUrl,
        ...overview,
        scores: this.scoresFromDomainOverview(overview),
      },
      createdAt: Date.now(),
    })
    this.pruneLocalScans()
    return { auditId }
  }

  async getAuditStatus(auditId: string): Promise<AuditStatus> {
    const local = this.localScans.get(auditId)
    if (local) {
      return {
        status: local.status === 'completed' ? 'completed' : 'failed',
        progress: 100,
        source: 'local-domain-overview',
      }
    }

    return this.callMcpTool<AuditStatus>('get_audit_status', { auditId })
  }

  async getAuditResults(projectId: string, auditId: string): Promise<Record<string, unknown>> {
    const local = this.localScans.get(auditId)
    if (local) {
      return local.result
    }

    return this.callMcpTool<Record<string, unknown>>('get_audit_results', { projectId, auditId })
  }

  getAuditLighthouseIssues(projectId: string, auditId: string): Promise<Record<string, unknown>> {
    return this.callMcpTool<Record<string, unknown>>('get_audit_lighthouse_issues', {
      projectId,
      auditId,
    })
  }

  getDomainOverview(input: {
    projectId: string
    domain: string
    includeSubdomains?: boolean
  }): Promise<Record<string, unknown>> {
    return this.callMcpTool<Record<string, unknown>>('get_domain_overview', {
      projectId: input.projectId,
      domain: input.domain,
      includeSubdomains: input.includeSubdomains ?? false,
    })
  }

  researchKeywords(input: KeywordResearchDto): Promise<Record<string, unknown>> {
    return this.callMcpTool<Record<string, unknown>>(
      'research_keywords',
      input as unknown as Record<string, unknown>,
    )
  }

  getKeywordMetrics(
    projectId: string,
    keywords: string[],
  ): Promise<Record<string, unknown>> {
    return this.callMcpTool<Record<string, unknown>>('get_keyword_metrics', {
      projectId,
      keywords,
    })
  }

  /** @deprecated Skills are not MCP tools on OpenSEO v0.0.x; kept for call-site compat. */
  keywordResearchForPage(
    pageId: string,
    opts?: KeywordResearchDto,
  ): Promise<Record<string, unknown>> {
    return this.researchKeywords({
      ...(opts ?? {}),
      seeds: opts?.seeds?.length ? opts.seeds : [pageId],
    })
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

  /** @deprecated execute_skill is not available on OpenSEO MCP research tools. */
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

    // MCP tools may return isError:true with text content instead of JSON-RPC error
    const result = parsed.result
    if (result && typeof result === 'object') {
      const record = result as Record<string, unknown>
      if (record.isError === true) {
        const text = this.extractTextContent(record)
        throw new BadGatewayException(text || `OpenSEO tool error`)
      }
    }

    return parsed
  }

  private parseMcpResponse(raw: string): McpJsonResponse {
    const trimmed = raw.trim()
    if (!trimmed) return {}

    if (trimmed.startsWith('data:') || trimmed.includes('\ndata:')) {
      const dataLine = trimmed
        .split(/\r?\n/)
        .find((line) => line.startsWith('data:'))
      if (!dataLine) return {}
      return JSON.parse(dataLine.replace(/^data:\s*/, '')) as McpJsonResponse
    }

    return JSON.parse(trimmed) as McpJsonResponse
  }

  private unwrapMcpResult(result: unknown): unknown {
    if (!result || typeof result !== 'object') return result
    const record = result as Record<string, unknown>

    if (record.structuredContent) return record.structuredContent

    const text = this.extractTextContent(record)
    if (text) {
      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    }

    return result
  }

  private extractTextContent(record: Record<string, unknown>): string | null {
    const content = record.content
    if (!Array.isArray(content)) return null
    const textItem = content.find(
      (item) => item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string',
    ) as { text?: string } | undefined
    return textItem?.text?.trim() || null
  }

  private normalizeProjectList(result: unknown): OpenSeoProject[] {
    if (Array.isArray(result)) {
      return result
        .map((item) => this.asProject(item))
        .filter((p): p is OpenSeoProject => Boolean(p?.id))
    }

    if (result && typeof result === 'object') {
      const projects = (result as { projects?: unknown }).projects
      if (Array.isArray(projects)) {
        return projects
          .map((item) => this.asProject(item))
          .filter((p): p is OpenSeoProject => Boolean(p?.id))
      }
    }

    return []
  }

  private asProject(item: unknown): OpenSeoProject | null {
    if (!item || typeof item !== 'object') return null
    const record = item as Record<string, unknown>
    const id = this.extractProjectId(record)
    if (!id) return null
    return {
      ...record,
      id,
      name: record.name != null ? String(record.name) : undefined,
      domain: record.domain != null ? String(record.domain) : null,
    }
  }

  private extractProjectId(value: unknown): string {
    if (!value || typeof value !== 'object') return ''
    const record = value as Record<string, unknown>
    return String(record.id ?? record.projectId ?? record.uuid ?? '').trim()
  }

  private domainFromUrl(startUrl: string): string {
    return extractHostname(startUrl) || startUrl
  }

  private normalizeDomain(value: string): string {
    return extractHostname(value) || value.trim().toLowerCase()
  }

  /**
   * Map domain overview metrics into holistic-ish 0–100 scores for FE cards.
   * Heuristic only — real Lighthouse/technical audits are not available via MCP.
   */
  private scoresFromDomainOverview(overview: Record<string, unknown>): Record<string, number> {
    const organicTraffic = Number(overview.organicTraffic ?? 0)
    const organicKeywords = Number(overview.organicKeywords ?? 0)
    const backlinks = Number(overview.backlinks ?? 0)
    const referringDomains = Number(overview.referringDomains ?? 0)

    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
    const logScore = (n: number, scale: number) =>
      clamp(n > 0 ? (Math.log10(n + 1) / Math.log10(scale + 1)) * 100 : 0)

    return {
      technicalsScore: clamp(organicKeywords > 0 ? 55 + logScore(organicKeywords, 10_000) * 0.3 : 40),
      uxScore: clamp(organicTraffic > 0 ? 50 + logScore(organicTraffic, 100_000) * 0.35 : 40),
      authorityScore: clamp(
        (logScore(backlinks, 100_000) + logScore(referringDomains, 10_000)) / 2,
      ),
      contentScore: clamp(organicKeywords > 0 ? 45 + logScore(organicKeywords, 50_000) * 0.4 : 35),
    }
  }

  private pruneLocalScans(): void {
    const maxAgeMs = 60 * 60 * 1000
    const now = Date.now()
    for (const [id, record] of this.localScans) {
      if (now - record.createdAt > maxAgeMs) this.localScans.delete(id)
    }
    // Cap size
    if (this.localScans.size > 200) {
      const oldest = [...this.localScans.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)
      for (const [id] of oldest.slice(0, this.localScans.size - 200)) {
        this.localScans.delete(id)
      }
    }
  }

  private get mcpUrl(): string {
    const explicit = this.configService.get<string>('OPENSEO_MCP_URL')
    if (explicit) return explicit

    const baseUrl = this.configService.get<string>('OPENSEO_BASE_URL') ?? 'http://openseo:7003'
    return `${baseUrl.replace(/\/$/, '')}/mcp`
  }
}
