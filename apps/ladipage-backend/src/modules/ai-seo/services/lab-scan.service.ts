import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { BullMqEnqueueService, TenantContextService } from '@liora/nest-core'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { Repository } from 'typeorm'

import {
  isBullMqEnabled,
  isBullMqWorkerEnabled,
} from '../../../config/bullmq.app.config'
import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { PageEntity } from '../../publish/entities'
import { CreateLabScanDto } from '../dto/create-lab-scan.dto'
import { SeoProjectEntity, SeoProjectPageEntity, SeoTaskEntity } from '../entities'
import { AI_SEO_QUEUES, type LabScanDepth, type LabScanTrigger } from '../queues/constants'
import type { UnlighthouseJobPayload } from '../types/unlighthouse-job.payload'
import {
  assertScanableUrl,
  phaseForTrigger,
} from '../utils/unlighthouse-url-policy'
import type { NormalizedLabResult } from '../utils/unlighthouse.normalizer'
import { extractHostname } from '../utils/domain.util'
import { UnlighthouseRunner } from './unlighthouse.runner'

const LAB_JOB_PREFIX = 'lab-'
/** Default 30s — shorter to avoid FE 30s axios timeout stacking with cooldown 429 UX */
const COOLDOWN_MS_DEFAULT = 30_000

@Injectable()
export class LabScanService extends TenantScopedService {
  private readonly logger = new Logger(LabScanService.name)

  constructor(
    tenantContext: TenantContextService,
    private readonly configService: ConfigService,
    private readonly runner: UnlighthouseRunner,
    @Optional() private readonly enqueue: BullMqEnqueueService | undefined,
    @InjectRepository(SeoProjectEntity)
    private readonly projectRepository: Repository<SeoProjectEntity>,
    @InjectRepository(SeoProjectPageEntity)
    private readonly pageRepository: Repository<SeoProjectPageEntity>,
    @InjectRepository(SeoTaskEntity)
    private readonly taskRepository: Repository<SeoTaskEntity>,
    @Optional()
    @InjectRepository(PageEntity)
    private readonly builderPageRepository: Repository<PageEntity> | undefined,
  ) {
    super(tenantContext)
  }

  static isLabJobId(jobId: string): boolean {
    return jobId.startsWith(LAB_JOB_PREFIX)
  }

  async startLabScan(
    dto: CreateLabScanDto,
    authToken?: string | null,
  ): Promise<{
    jobId: string
    status: string
    targetUrl: string
    phase: string
    trigger: string
    /** Present when reusing a completed scan within cooldown */
    result?: Record<string, unknown>
  }> {
    const tenantId = this.requireTenantId()
    const trigger = dto.trigger
    const depth: LabScanDepth = dto.depth ?? 'quick'

    const resolved = await this.resolveTargets(dto, tenantId)
    // Unlighthouse supports localhost. list/editor default allow local for pre-publish.
    // Explicit allowLocal:false forces public-only. Env UNLIGHTHOUSE_ALLOW_LOCAL=true enables globally.
    const allowLocal =
      dto.allowLocal === true ||
      (dto.allowLocal !== false &&
        (trigger === 'editor' ||
          trigger === 'list' ||
          this.configService.get<string>('UNLIGHTHOUSE_ALLOW_LOCAL') === 'true'))

    const previewSuffixes = (this.configService.get<string>('UNLIGHTHOUSE_PREVIEW_HOST_SUFFIXES') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    // A published page is served at /p/{slug}; a draft is NOT — so a pre-publish
    // scan of a local /p/{slug} would 404. Resolve a signed lab-preview URL from
    // the FE (renders the current editor artifact, works for draft AND published).
    const scanTargetUrl = await this.resolveScanUrl(
      resolved.targetUrl,
      resolved.websitePageId,
      trigger,
      authToken,
    )

    const urlCheck = assertScanableUrl(scanTargetUrl, {
      allowLocal,
      previewHostSuffixes: previewSuffixes,
    })
    if (urlCheck.ok === false) {
      throw new BadRequestException(urlCheck.reason)
    }

    await this.assertDataOwnership(tenantId, resolved)

    // Cooldown: reuse recent job (pending or completed) — avoids 429-like spam + timeout
    const cooldownMs = Number(
      this.configService.get<string>('UNLIGHTHOUSE_COOLDOWN_MS') ?? COOLDOWN_MS_DEFAULT,
    )
    if (cooldownMs > 0) {
      const recent = await this.findRecentLabJob(
        tenantId,
        resolved.seoProjectId,
        resolved.seoProjectPageId,
        resolved.websitePageId,
        cooldownMs,
      )
      if (recent) {
        const done = recent.status === 'approved' || recent.status === 'deployed'
        const failed = recent.status === 'rejected'
        // Do NOT reuse failed jobs — user would instantly see "Quét lab thất bại" for 60s
        if (failed) {
          // fall through to start a new scan
        } else {
          return {
            jobId: recent.externalTaskId!,
            status: done ? 'success' : 'queued',
            targetUrl: urlCheck.url,
            phase: phaseForTrigger(trigger, urlCheck.kind),
            trigger,
            result: done ? (recent.result as Record<string, unknown>) : undefined,
          }
        }
      }
    }

    const jobId = `${LAB_JOB_PREFIX}${randomUUID()}`
    const phase = phaseForTrigger(trigger, urlCheck.kind)
    const samples = depth === 'full' ? 3 : 1
    const mock =
      dto.mock === true ||
      this.runner.shouldMock({ mock: false }) ||
      this.configService.get<string>('UNLIGHTHOUSE_MODE') === 'mock'

    const payload: UnlighthouseJobPayload = {
      jobId,
      tenantId,
      seoProjectId: resolved.seoProjectId,
      seoProjectPageId: resolved.seoProjectPageId,
      websitePageId: resolved.websitePageId,
      targetUrl: urlCheck.url,
      trigger,
      phase,
      depth,
      device: 'mobile',
      samples,
      mock,
    }

    const task = this.taskRepository.create({
      seoProjectId: resolved.seoProjectId,
      externalTaskId: jobId,
      type: 'AUDIT',
      status: 'pending',
      payload: {
        source: 'unlighthouse',
        tenantId,
        trigger,
        phase,
        targetUrl: urlCheck.url,
        targetKind: urlCheck.kind,
        seoProjectPageId: resolved.seoProjectPageId,
        websitePageId: resolved.websitePageId,
        depth,
        mock,
      },
      result: {},
    })
    await this.taskRepository.save(task)

    if (resolved.seoProjectPageId) {
      await this.pageRepository.update(
        { id: resolved.seoProjectPageId, tenantId },
        {
          scanStatus: 'scanning',
          lastScanJobId: jobId,
        },
      )
    }

    const project = await this.projectRepository.findOne({
      where: { id: resolved.seoProjectId, tenantId },
    })
    if (project) {
      project.taskStatus = 'running'
      await this.projectRepository.save(project)
    }

    // Inline when: no BullMQ, no enqueue, mock, INLINE=true, or API has no worker
    // (BULLMQ_RUN_WORKERS=false) — otherwise FE polls forever → timeout.
    const noWorkerInThisProcess = !isBullMqWorkerEnabled()
    const forceInline =
      !isBullMqEnabled() ||
      !this.enqueue ||
      mock ||
      noWorkerInThisProcess ||
      this.configService.get<string>('UNLIGHTHOUSE_INLINE') === 'true'

    if (forceInline) {
      if (noWorkerInThisProcess && !mock) {
        this.logger.warn(
          `Lab scan job=${jobId} running INLINE (BULLMQ_RUN_WORKERS=false — no queue consumer). ` +
            `For async CLI lab, start serve-worker with BULLMQ_RUN_WORKERS=true.`,
        )
      }
      await this.processPayload(payload)
      // Re-read task so caller gets scores without a second GET poll loop
      const done = await this.taskRepository.findOne({
        where: { externalTaskId: jobId, seoProjectId: resolved.seoProjectId },
      })
      return {
        jobId,
        status:
          done?.status === 'rejected'
            ? 'failed'
            : 'success',
        targetUrl: urlCheck.url,
        phase,
        trigger,
        result: (done?.result as Record<string, unknown>) ?? undefined,
      }
    }

    try {
      await this.enqueue!.add(AI_SEO_QUEUES.LIGHTHOUSE, 'lighthouse-scan', payload, {
        jobId,
        priority: trigger === 'editor' || trigger === 'list' ? 5 : 15,
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
      })
      this.logger.log(`Lab scan job=${jobId} enqueued (worker will process)`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Enqueue lab scan failed: ${message}`)
      // Fail-soft: process inline so UX still works
      await this.processPayload({
        ...payload,
        mock,
      })
      const done = await this.taskRepository.findOne({
        where: { externalTaskId: jobId, seoProjectId: resolved.seoProjectId },
      })
      return {
        jobId,
        status: done?.status === 'rejected' ? 'failed' : 'success',
        targetUrl: urlCheck.url,
        phase,
        trigger,
        result: (done?.result as Record<string, unknown>) ?? undefined,
      }
    }

    return {
      jobId,
      status: 'queued',
      targetUrl: urlCheck.url,
      phase,
      trigger,
    }
  }

  /**
   * Tenant-scoped job read. Never returns another tenant's lab scan.
   */
  async getLabScan(jobId: string) {
    const tenantId = this.requireTenantId()
    if (!LabScanService.isLabJobId(jobId)) {
      throw new NotFoundException('Lab scan job not found')
    }

    const task = await this.taskRepository
      .createQueryBuilder('task')
      .innerJoin(SeoProjectEntity, 'project', 'project.id = task.seoProjectId')
      .where('task.externalTaskId = :jobId', { jobId })
      .andWhere('project.tenantId = :tenantId', { tenantId })
      .getOne()

    if (!task) {
      throw new NotFoundException('Lab scan job not found')
    }

    const payloadTenant = Number((task.payload as { tenantId?: number })?.tenantId)
    if (payloadTenant && payloadTenant !== tenantId) {
      throw new ForbiddenException('Lab scan job not found')
    }

    const result = (task.result ?? {}) as Record<string, unknown>
    const status =
      task.status === 'approved' || task.status === 'deployed'
        ? 'success'
        : task.status === 'rejected'
          ? 'failed'
          : 'queued'

    return {
      jobId,
      taskId: task.id,
      projectId: task.seoProjectId,
      status,
      progress: status === 'success' || status === 'failed' ? 100 : 10,
      error: typeof result.error === 'string' ? result.error : undefined,
      errorCode: typeof result.errorCode === 'string' ? result.errorCode : undefined,
      hint: typeof result.hint === 'string' ? result.hint : undefined,
      result: {
        source: 'unlighthouse',
        ...(result as object),
      },
      payload: task.payload,
    }
  }

  /** Worker entry — re-validates tenant isolation. */
  async processPayload(payload: UnlighthouseJobPayload): Promise<void> {
    const task = await this.taskRepository.findOne({
      where: { externalTaskId: payload.jobId, seoProjectId: payload.seoProjectId },
    })
    if (!task) {
      this.logger.warn(`Lab task missing job=${payload.jobId}`)
      return
    }

    const project = await this.projectRepository.findOne({
      where: { id: payload.seoProjectId },
    })
    if (!project || project.tenantId !== payload.tenantId) {
      this.logger.error(
        `Tenant mismatch lab job=${payload.jobId} payloadTenant=${payload.tenantId} projectTenant=${project?.tenantId}`,
      )
      task.status = 'rejected'
      task.result = { error: 'tenant_mismatch', source: 'unlighthouse' }
      await this.taskRepository.save(task)
      return
    }

    const payloadTenant = Number((task.payload as { tenantId?: number })?.tenantId)
    if (payloadTenant && payloadTenant !== payload.tenantId) {
      task.status = 'rejected'
      task.result = { error: 'tenant_mismatch', source: 'unlighthouse' }
      await this.taskRepository.save(task)
      return
    }

    try {
      const lab = await this.runner.run(payload)
      if (!this.hasUsableLabScores(lab)) {
        await this.persistFailure(
          project,
          task,
          payload,
          'Unlighthouse completed but did not return Lighthouse scores',
          'no_lighthouse_scores',
          'CLI chay xong nhung report khong co categories/audits hoac page unreachable. Bat UNLIGHTHOUSE_DEBUG_KEEP_REPORT=true de giu artifact va kiem tra lighthouse.json.',
          lab,
        )
        return
      }
      await this.persistSuccess(project, task, payload, lab)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `Lab scan FAILED job=${payload.jobId} url=${payload.targetUrl} mock=${payload.mock}: ${message}`,
      )
      await this.persistFailure(
        project,
        task,
        payload,
        message,
        this.classifyLabError(message),
        this.hintForLabError(message),
      )
    }
  }

  private classifyLabError(message: string): string {
    const m = message.toLowerCase()
    if (/fs\/promises|named 'glob'|node\.js v20|node >= 22|cần node >= 22/i.test(message)) {
      return 'node_too_old'
    }
    // url_unreachable first: an HTTP "404 Not Found" must not fall into cli_missing via a bare "not found" match
    if (/target url unreachable|invalid response from url|http\s+[45]\d\d|econnrefused|enotfound|net::|navigation/i.test(m)) return 'url_unreachable'
    if (/enoent|command not found|spawn unlighthouse/i.test(message)) return 'cli_missing'
    if (/timeout|etimedout|killed/i.test(m)) return 'timeout'
    if (/chrome|chromium|puppeteer|browser/i.test(m)) return 'chrome_missing'
    return 'runner_error'
  }

  private hintForLabError(message: string): string {
    const code = this.classifyLabError(message)
    switch (code) {
      case 'node_too_old':
        return 'Container đang Node 20. Rebuild: docker compose build --no-cache liora-ladipage && up -d (Dockerfile node:22-alpine).'
      case 'cli_missing':
        return 'Trong monorepo: pnpm add -w @unlighthouse/cli puppeteer rồi rebuild container.'
      case 'chrome_missing':
        return 'Image cần apk chromium (đã thêm Dockerfile). Rebuild container.'
      case 'timeout':
        return 'URL chậm hoặc Chrome treo. Kiểm tra FE qua host.docker.internal:3000 từ container.'
      case 'url_unreachable':
        return 'URL scan khong tra HTML 2xx tu container. Kiem tra publish/slug va thu curl http://host.docker.internal:3000/p/{slug}; neu 404 thi can publish trang hoac truyen URL preview/public dung.'
      case 'no_lighthouse_scores':
        return 'Unlighthouse da chay nhung khong doc duoc Lighthouse scores. Bat UNLIGHTHOUSE_DEBUG_KEEP_REPORT=true, scan lai, roi kiem tra ci-result.json va lighthouse.json trong artifact.'
      default:
        return 'Xem Nest log [LabScanService] / [UnlighthouseRunner].'
    }
  }

  private hasUsableLabScores(lab: NormalizedLabResult): boolean {
    return lab.pages.some((page) =>
      Object.values(page.scores).some((score) => score != null),
    )
  }

  private async persistFailure(
    project: SeoProjectEntity,
    task: SeoTaskEntity,
    payload: UnlighthouseJobPayload,
    error: string,
    errorCode: string,
    hint: string,
    lab?: NormalizedLabResult,
  ): Promise<void> {
    this.logger.warn(
      `Lab scan rejected job=${payload.jobId} code=${errorCode} url=${payload.targetUrl}`,
    )
    task.status = 'rejected'
    task.result = {
      source: 'unlighthouse',
      error,
      errorCode,
      targetUrl: payload.targetUrl,
      trigger: payload.trigger,
      phase: payload.phase,
      mock: payload.mock,
      hint,
      ...(lab ? { lighthouse: lab } : {}),
    }
    await this.taskRepository.save(task)

    if (payload.seoProjectPageId) {
      await this.pageRepository.update(
        { id: payload.seoProjectPageId, tenantId: payload.tenantId },
        { scanStatus: 'failed' },
      )
    }
    project.taskStatus = 'failed'
    await this.projectRepository.save(project)
  }

  async enqueueAfterPublish(input: {
    tenantId: number
    seoProjectId: string
    websitePageId: string
    publicUrl: string | null | undefined
  }): Promise<{ jobId: string | null; skipped: boolean; reason?: string }> {
    const auto =
      this.configService.get<string>('UNLIGHTHOUSE_AUTO_ON_PUBLISH') !== 'false' &&
      this.configService.get<string>('UNLIGHTHOUSE_AUTO_ON_PUBLISH') !== '0'
    if (!auto) {
      return { jobId: null, skipped: true, reason: 'auto_disabled' }
    }
    if (!input.publicUrl?.trim()) {
      return { jobId: null, skipped: true, reason: 'no_public_url' }
    }

    // Skip if recent pre-publish lab for same page
    const skipMinutes = Number(
      this.configService.get<string>('UNLIGHTHOUSE_PUBLISH_SKIP_IF_RECENT_MIN') ?? 15,
    )
    const page = await this.pageRepository.findOne({
      where: {
        tenantId: input.tenantId,
        seoProjectId: input.seoProjectId,
        websitePageId: input.websitePageId,
      },
    })
    if (page?.lastScannedAt && skipMinutes > 0) {
      const age = Date.now() - page.lastScannedAt.getTime()
      if (age < skipMinutes * 60_000) {
        const last = page.scores as { lighthouse?: { phase?: string } }
        if (last?.lighthouse) {
          return { jobId: page.lastScanJobId, skipped: true, reason: 'recent_lab_scan' }
        }
      }
    }

    // Run without request CLS — set tenant via direct process with ownership already checked by publish
    const jobId = `${LAB_JOB_PREFIX}${randomUUID()}`
    const urlCheck = assertScanableUrl(input.publicUrl, { allowLocal: false })
    if (urlCheck.ok === false) {
      return { jobId: null, skipped: true, reason: urlCheck.reason }
    }

    const payload: UnlighthouseJobPayload = {
      jobId,
      tenantId: input.tenantId,
      seoProjectId: input.seoProjectId,
      seoProjectPageId: page?.id ?? null,
      websitePageId: input.websitePageId,
      targetUrl: urlCheck.url,
      trigger: 'publish',
      phase: 'post_publish',
      depth: 'quick',
      device: 'mobile',
      samples: 1,
      mock: this.runner.shouldMock({ mock: false }),
    }

    const task = this.taskRepository.create({
      seoProjectId: input.seoProjectId,
      externalTaskId: jobId,
      type: 'AUDIT',
      status: 'pending',
      payload: {
        source: 'unlighthouse',
        tenantId: input.tenantId,
        trigger: 'publish',
        phase: 'post_publish',
        targetUrl: urlCheck.url,
        seoProjectPageId: page?.id ?? null,
        websitePageId: input.websitePageId,
      },
      result: {},
    })
    await this.taskRepository.save(task)

    if (page) {
      await this.pageRepository.update(
        { id: page.id, tenantId: input.tenantId },
        { scanStatus: 'scanning', lastScanJobId: jobId },
      )
    }

    const forceInline =
      !isBullMqEnabled() ||
      !this.enqueue ||
      payload.mock ||
      !isBullMqWorkerEnabled() ||
      this.configService.get<string>('UNLIGHTHOUSE_INLINE') === 'true'

    try {
      if (forceInline) {
        await this.processPayload(payload)
      } else {
        await this.enqueue!.add(AI_SEO_QUEUES.LIGHTHOUSE, 'lighthouse-scan', payload, {
          jobId,
          priority: 20,
        })
      }
      return { jobId, skipped: false }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Publish auto lab scan soft-fail: ${message}`)
      return { jobId: null, skipped: true, reason: message }
    }
  }

  private async persistSuccess(
    project: SeoProjectEntity,
    task: SeoTaskEntity,
    payload: UnlighthouseJobPayload,
    lab: NormalizedLabResult,
  ) {
    const primary = lab.pages[0]
    task.status = 'approved'
    task.result = {
      source: 'unlighthouse',
      lighthouse: lab,
      scores: primary?.scores ?? null,
      metrics: primary?.metrics ?? null,
      targetUrl: payload.targetUrl,
      trigger: payload.trigger,
      phase: payload.phase,
    }
    await this.taskRepository.save(task)

    const prev = project.siteAudit ?? {}
    const prevModes = Array.isArray(prev.modes)
      ? (prev.modes as string[])
      : typeof prev.mode === 'string'
        ? String(prev.mode).split('+').filter(Boolean)
        : typeof prev.source === 'string'
          ? String(prev.source).split('+').filter(Boolean)
          : []

    project.siteAudit = {
      ...prev,
      lighthouse: {
        jobId: payload.jobId,
        fetchedAt: lab.fetchedAt,
        mock: lab.mock,
        aggregate: lab.aggregate,
        pages: lab.pages,
        trigger: payload.trigger,
        phase: payload.phase,
        targetUrl: payload.targetUrl,
      },
      modes: Array.from(new Set([...prevModes, 'unlighthouse'])),
    }
    project.holisticScores = {
      ...(project.holisticScores ?? {}),
      lighthouse: primary?.scores ?? {},
      performanceScore: primary?.scores.performance ?? null,
      lighthouseSeoScore: primary?.scores.seo ?? null,
    }
    project.lastAnalysisAt = new Date()
    project.taskStatus = 'done'
    await this.projectRepository.save(project)

    if (payload.seoProjectPageId) {
      const page = await this.pageRepository.findOne({
        where: { id: payload.seoProjectPageId, tenantId: payload.tenantId },
      })
      if (page) {
        page.scanStatus = 'completed'
        page.lastScannedAt = new Date()
        page.lastScanJobId = payload.jobId
        const lh = (primary?.scores ?? {}) as Record<string, number | null | undefined>
        const parseNum = (v: unknown): number => {
          const n = Number(v)
          return Number.isFinite(n) ? n : 0
        }
        const tech = parseNum(lh.seo ?? page.scores?.technicalScore)
        const ux = parseNum(lh.performance ?? page.scores?.uxScore)
        const a11y = parseNum(lh.accessibility)
        const bp = parseNum(lh['best-practices'])
        const grader = Math.round((tech + ux + a11y + bp) / 4)

        page.scores = {
          ...(page.scores ?? {}),
          lighthouse: {
            scores: lh,
            metrics: primary?.metrics ?? {},
            issues: primary?.issues ?? [],
            fetchedAt: lab.fetchedAt,
            mock: lab.mock,
            phase: payload.phase,
            targetUrl: payload.targetUrl,
          },
          // Map for existing scorecards
          graderScore: grader > 0 ? grader : (page.scores?.graderScore ?? 0),
          technicalScore: tech,
          uxScore: ux,
          contentScore: bp > 0 ? bp : (page.scores?.contentScore ?? tech),
          authorityScore: page.scores?.authorityScore ?? 0,
        }
        await this.pageRepository.save(page)
      }
    }

    await this.upsertLabIssueTasks(project.id, payload, lab)
  }

  private async upsertLabIssueTasks(
    seoProjectId: string,
    payload: UnlighthouseJobPayload,
    lab: NormalizedLabResult,
  ) {
    const issues = (lab.pages[0]?.issues ?? []).slice(0, 10)
    for (const issue of issues) {
      const externalKey = `ulh:${payload.seoProjectPageId ?? 'p'}:${issue.auditKey}`
      const existing = await this.taskRepository.findOne({
        where: { seoProjectId, externalTaskId: externalKey },
      })
      if (existing) continue

      await this.taskRepository.save(
        this.taskRepository.create({
          seoProjectId,
          externalTaskId: externalKey,
          type: issue.category === 'performance' ? 'TECHNICAL' : 'ON_PAGE',
          status: 'pending',
          payload: {
            source: 'unlighthouse',
            title: issue.title,
            description: issue.description,
            category: issue.category,
            priority: issue.severity === 'critical' ? 'high' : 'medium',
            auditKey: issue.auditKey,
            websitePageId: payload.websitePageId,
            seoProjectPageId: payload.seoProjectPageId,
            tenantId: payload.tenantId,
          },
          result: {
            feStatus: 'todo',
            impactMs: issue.impactMs,
            items: issue.items,
          },
        }),
      )
    }
  }

  /**
   * A published landing page is served at /p/{slug}; a draft is not, so a
   * pre-publish scan of a local /p/{slug} 404s. Resolve a signed lab-preview URL
   * from the FE, which renders the current editor artifact for BOTH draft and
   * published pages. Only local targets need this bridge — public URLs are
   * scanned directly. Falls back to the original URL when a preview can't be built.
   */
  private async resolveScanUrl(
    targetUrl: string,
    websitePageId: string | null,
    trigger: LabScanTrigger,
    authToken?: string | null,
  ): Promise<string> {
    let host: string
    try {
      const withProtocol = /^https?:\/\//i.test(targetUrl) ? targetUrl : `https://${targetUrl}`
      host = new URL(withProtocol).hostname.toLowerCase()
    } catch {
      return targetUrl
    }

    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === 'host.docker.internal' ||
      host.endsWith('.local')
    if (!isLocal) return targetUrl
    // Without page id + auth we cannot build a signed preview; keep original
    // (a published /p/{slug} on localhost may still resolve).
    if (!websitePageId || !authToken) return targetUrl

    const preview = await this.fetchLabPreviewUrl(websitePageId, authToken)
    if (preview) {
      this.logger.log(
        `Resolved lab-preview URL for page=${websitePageId} trigger=${trigger} (draft/published safe)`,
      )
      return preview
    }
    return targetUrl
  }

  private feBaseUrl(): string {
    const base =
      this.configService.get<string>('LANDING_ORIGIN_BASE_URL')?.trim() ||
      process.env.LANDING_ORIGIN_BASE_URL?.trim() ||
      'http://localhost:3000'
    return base.split(',')[0].trim().replace(/\/$/, '')
  }

  /** Docker Nest reaches host FE via host.docker.internal, not container loopback. */
  private rewriteFeOriginForRuntime(origin: string): string {
    try {
      const u = new URL(origin)
      const host = u.hostname.toLowerCase()
      const inDocker =
        existsSync('/.dockerenv') ||
        this.configService.get<string>('RUNNING_IN_DOCKER') === 'true' ||
        process.env.RUNNING_IN_DOCKER === 'true'
      if (
        inDocker &&
        (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0')
      ) {
        const bridge =
          this.configService.get<string>('UNLIGHTHOUSE_HOST_BRIDGE')?.trim() ||
          process.env.UNLIGHTHOUSE_HOST_BRIDGE?.trim() ||
          'host.docker.internal'
        u.hostname = bridge
      }
      return u.toString().replace(/\/$/, '')
    } catch {
      return origin
    }
  }

  private async fetchLabPreviewUrl(
    websitePageId: string,
    authToken: string,
  ): Promise<string | null> {
    const origin = this.rewriteFeOriginForRuntime(this.feBaseUrl())
    const url = `${origin}/api/landing-pages/${encodeURIComponent(websitePageId)}/lab-preview`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`,
        },
      })
      if (!res.ok) {
        this.logger.warn(
          `lab-preview request failed HTTP ${res.status} for page=${websitePageId} (${url})`,
        )
        return null
      }
      const body = (await res.json().catch(() => null)) as { previewUrl?: unknown } | null
      return typeof body?.previewUrl === 'string' ? body.previewUrl : null
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`lab-preview fetch error page=${websitePageId}: ${message}`)
      return null
    } finally {
      clearTimeout(timeout)
    }
  }

  private async resolveTargets(
    dto: CreateLabScanDto,
    tenantId: number,
  ): Promise<{
    seoProjectId: string
    seoProjectPageId: string | null
    websitePageId: string | null
    targetUrl: string
  }> {
    let seoProjectId = dto.seoProjectId?.trim() || null
    let seoProjectPageId = dto.seoProjectPageId?.trim() || null
    let websitePageId = dto.websitePageId?.trim() || null
    let targetUrl = dto.targetUrl?.trim() || ''

    if (seoProjectPageId) {
      const page = await this.pageRepository.findOne({
        where: { id: seoProjectPageId, tenantId },
      })
      if (!page) throw new NotFoundException('SEO project page not found')
      if (seoProjectId && page.seoProjectId !== seoProjectId) {
        throw new ForbiddenException('Page does not belong to project')
      }
      seoProjectId = page.seoProjectId
      websitePageId = page.websitePageId ?? websitePageId
      if (!targetUrl) targetUrl = page.pageUrl
    }

    // Landing Pages list: only websitePageId (+ optional targetUrl)
    if (!seoProjectId && websitePageId) {
      const linked = await this.ensureMinimalProjectForWebsitePage(
        tenantId,
        websitePageId,
        targetUrl || null,
      )
      seoProjectId = linked.seoProjectId
      seoProjectPageId = linked.seoProjectPageId
      if (!targetUrl) targetUrl = linked.pageUrl
    }

    if (seoProjectId) {
      const project = await this.projectRepository.findOne({
        where: { id: seoProjectId, tenantId },
      })
      if (!project) throw new NotFoundException('SEO project not found')
    }

    if (websitePageId && this.builderPageRepository && !targetUrl) {
      const builder = await this.builderPageRepository.findOne({
        where: { tenantId, externalId: websitePageId, isDelete: false },
      })
      if (builder) {
        targetUrl =
          builder.pageUrl ||
          builder.url ||
          (builder.domain
            ? `https://${builder.domain}${builder.path || '/'}`
            : '') ||
          ''
      }
    }

    if (!seoProjectId) {
      throw new BadRequestException(
        'seoProjectId, seoProjectPageId, or websitePageId is required',
      )
    }

    if (!targetUrl) {
      const project = await this.projectRepository.findOne({
        where: { id: seoProjectId, tenantId },
      })
      if (project?.hostname && project.hostname.includes('.')) {
        targetUrl = `https://${project.hostname}/`
      }
    }

    if (!targetUrl) {
      throw new BadRequestException(
        'No scannable URL. Publish the landing page (public URL) or pass targetUrl.',
      )
    }

    // Ensure linked seo project page for list/editor website-only scans
    if (!seoProjectPageId && websitePageId) {
      seoProjectPageId = await this.ensureSeoProjectPage(
        tenantId,
        seoProjectId,
        websitePageId,
        targetUrl,
      )
    }

    return {
      seoProjectId,
      seoProjectPageId,
      websitePageId,
      targetUrl,
    }
  }

  /**
   * Lightweight ensure — no OpenSEO/Umami calls (avoids timeout / too many requests).
   * Tenant-scoped only.
   */
  private async ensureMinimalProjectForWebsitePage(
    tenantId: number,
    websitePageId: string,
    publicUrl: string | null,
  ): Promise<{ seoProjectId: string; seoProjectPageId: string | null; pageUrl: string }> {
    const existing = await this.projectRepository.findOne({
      where: { tenantId, landingPageId: websitePageId },
    })
    if (existing) {
      const page = await this.pageRepository.findOne({
        where: {
          tenantId,
          seoProjectId: existing.id,
          websitePageId,
        },
      })
      return {
        seoProjectId: existing.id,
        seoProjectPageId: page?.id ?? null,
        pageUrl: publicUrl || page?.pageUrl || '',
      }
    }

    let hostname = publicUrl ? extractHostname(publicUrl) : ''
    if (!hostname || !hostname.includes('.')) {
      hostname = `lp-${websitePageId.slice(0, 8)}.local`
    }

    const created = await this.projectRepository.save(
      this.projectRepository.create({
        tenantId,
        storeId: null,
        landingPageId: websitePageId,
        name: hostname,
        hostname,
        slug: hostname.replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 80),
        status: 'active',
        openseoProjectId: null,
        taskStatus: 'pending',
        holisticScores: {},
        connectedData: {},
        siteAudit: {},
      }),
    )

    const pageUrl = publicUrl || `https://${hostname}/`
    const pageId = await this.ensureSeoProjectPage(tenantId, created.id, websitePageId, pageUrl)
    return {
      seoProjectId: created.id,
      seoProjectPageId: pageId,
      pageUrl,
    }
  }

  private async ensureSeoProjectPage(
    tenantId: number,
    seoProjectId: string,
    websitePageId: string,
    pageUrl: string,
  ): Promise<string> {
    const existing = await this.pageRepository.findOne({
      where: { tenantId, seoProjectId, websitePageId },
    })
    if (existing) {
      if (pageUrl && existing.pageUrl !== pageUrl) {
        existing.pageUrl = pageUrl
        await this.pageRepository.save(existing)
      }
      return existing.id
    }
    const page = await this.pageRepository.save(
      this.pageRepository.create({
        tenantId,
        seoProjectId,
        pageUrl: pageUrl || `https://localhost/${websitePageId}`,
        websitePageId,
        source: 'internal',
        scanStatus: 'pending',
        scores: {},
      }),
    )
    return page.id
  }

  private async assertDataOwnership(
    tenantId: number,
    resolved: {
      seoProjectId: string
      seoProjectPageId: string | null
      websitePageId: string | null
    },
  ) {
    const project = await this.projectRepository.findOne({
      where: { id: resolved.seoProjectId, tenantId },
    })
    if (!project) throw new ForbiddenException('SEO project not found')

    if (resolved.seoProjectPageId) {
      const page = await this.pageRepository.findOne({
        where: {
          id: resolved.seoProjectPageId,
          tenantId,
          seoProjectId: resolved.seoProjectId,
        },
      })
      if (!page) throw new ForbiddenException('SEO project page not found')
    }

    if (resolved.websitePageId && this.builderPageRepository) {
      const builder = await this.builderPageRepository.findOne({
        where: {
          tenantId,
          externalId: resolved.websitePageId,
          isDelete: false,
        },
      })
      // If builder row exists under another tenant query won't find it — ok.
      // If exists for this tenant, good. If null, external pages may still be linked.
      void builder
    }
  }

  private async findRecentLabJob(
    tenantId: number,
    seoProjectId: string,
    seoProjectPageId: string | null,
    websitePageId: string | null,
    cooldownMs: number,
  ): Promise<SeoTaskEntity | null> {
    const since = new Date(Date.now() - cooldownMs)
    const qb = this.taskRepository
      .createQueryBuilder('task')
      .innerJoin(SeoProjectEntity, 'project', 'project.id = task.seoProjectId')
      .where('project.tenantId = :tenantId', { tenantId })
      .andWhere('task.seoProjectId = :seoProjectId', { seoProjectId })
      .andWhere("task.externalTaskId LIKE 'lab-%'")
      .andWhere('task.createdAt >= :since', { since })
      .orderBy('task.createdAt', 'DESC')
      .limit(1)

    if (seoProjectPageId) {
      qb.andWhere("task.payload ::text LIKE :page", {
        page: `%"seoProjectPageId":"${seoProjectPageId}"%`,
      })
    } else if (websitePageId) {
      qb.andWhere("task.payload ::text LIKE :wp", {
        wp: `%"websitePageId":"${websitePageId}"%`,
      })
    }

    return qb.getOne()
  }
}
