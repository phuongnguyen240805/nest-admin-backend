import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { execFile, execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { mkdtemp, readFile, readdir, rm } from 'fs/promises'
import { platform, tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'

import type { UnlighthouseJobPayload } from '../types/unlighthouse-job.payload'
import {
  buildMockUnlighthouseRaw,
  normalizeUnlighthouseOutput,
  type NormalizedLabResult,
} from '../utils/unlighthouse.normalizer'

const execFileAsync = promisify(execFile)

function objectFromUnknown(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
}

function rowsFromRaw(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  const object = objectFromUnknown(raw)
  if (!object) return []

  for (const key of ['pages', 'routes', 'results', 'reports']) {
    const rows = object[key]
    if (Array.isArray(rows)) return rows
    const rowMap = objectFromUnknown(rows)
    if (rowMap) return Object.values(rowMap)
  }

  return [object]
}

function hasLighthouseCategoriesAndAudits(raw: unknown): boolean {
  for (const row of rowsFromRaw(raw)) {
    const object = objectFromUnknown(row)
    if (!object) continue
    const report =
      objectFromUnknown(object.report) ??
      objectFromUnknown(object.lhr) ??
      objectFromUnknown(object.lighthouse) ??
      objectFromUnknown(object.lighthouseResult) ??
      objectFromUnknown(object.result) ??
      object
    if (objectFromUnknown(report.categories)) {
      return true
    }
  }
  return false
}

function hasAnyScore(result: NormalizedLabResult): boolean {
  return result.pages.some((page) =>
    Object.values(page.scores).some((score) => score != null),
  )
}

@Injectable()
export class UnlighthouseRunner {
  private readonly logger = new Logger(UnlighthouseRunner.name)
  private cliAvailableCache: boolean | null = null
  private resolvedBinCache: string | null = null

  constructor(private readonly configService: ConfigService) {}

  shouldMock(payload: Pick<UnlighthouseJobPayload, 'mock'>): boolean {
    if (payload.mock) return true
    if (process.env.NODE_ENV === 'test') return true
    const mode = (this.configService.get<string>('UNLIGHTHOUSE_MODE') ?? 'cli').toLowerCase()
    if (mode === 'mock') return true
    if ((mode === 'cli' || mode === 'auto' || mode === '') && !this.isCliAvailable()) {
      this.logger.warn(
        'UNLIGHTHOUSE_MODE=cli nhưng không tìm thấy unlighthouse-ci trong monorepo/PATH. ' +
          'Cài: pnpm add -w @unlighthouse/cli puppeteer (dùng Chrome máy: PUPPETEER_EXECUTABLE_PATH).',
      )
      const fallback =
        this.configService.get<string>('UNLIGHTHOUSE_FALLBACK_MOCK') === 'true' ||
        this.configService.get<string>('UNLIGHTHOUSE_FALLBACK_MOCK') === '1'
      return fallback
    }
    return false
  }

  /**
   * Prefer monorepo local CLI over global:
   * node_modules/.bin/unlighthouse-ci
   */
  private resolveCliBin(): string {
    if (this.resolvedBinCache) return this.resolvedBinCache
    const configured = this.configService.get<string>('UNLIGHTHOUSE_BIN')?.trim()
    const candidates: string[] = []
    if (configured) candidates.push(configured)

    // Walk up from cwd for monorepo root node_modules/.bin
    let dir = process.cwd()
    for (let i = 0; i < 8; i++) {
      candidates.push(
        join(dir, 'node_modules', '.bin', 'unlighthouse-ci'),
        join(dir, 'node_modules', '.bin', 'unlighthouse-ci.cmd'),
        join(dir, 'node_modules', '@unlighthouse', 'cli', 'bin', 'unlighthouse-ci.mjs'),
        join(dir, 'node_modules', '@unlighthouse', 'cli', 'bin', 'unlighthouse-ci.js'),
      )
      const parent = join(dir, '..')
      if (parent === dir) break
      dir = parent
    }
    candidates.push('unlighthouse-ci')

    for (const c of candidates) {
      if (c === 'unlighthouse-ci' || c === 'npx') {
        this.resolvedBinCache = c
        return c
      }
      if (existsSync(c)) {
        this.resolvedBinCache = c
        return c
      }
    }
    this.resolvedBinCache = 'unlighthouse-ci'
    return this.resolvedBinCache
  }

  /**
   * Chrome already on Windows: use it (no reinstall).
   * Linux WSL cannot exec chrome.exe — need Linux chromium/puppeteer bundle.
   */
  private resolveChromePath(): string | undefined {
    const fromEnv =
      this.configService.get<string>('PUPPETEER_EXECUTABLE_PATH')?.trim() ||
      this.configService.get<string>('CHROME_PATH')?.trim() ||
      process.env.PUPPETEER_EXECUTABLE_PATH?.trim() ||
      process.env.CHROME_PATH?.trim()
    if (fromEnv && existsSync(fromEnv)) return fromEnv

    const isWin = platform() === 'win32'
    const winCandidates = [
      'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
      'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
      // WSL path to Windows Chrome (only useful if process is Windows node)
      '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
    ]
    const linuxCandidates = [
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
    ]

    const list = isWin ? winCandidates : [...linuxCandidates, ...winCandidates]
    for (const p of list) {
      if (existsSync(p)) {
        // Windows PE binary under WSL linux node cannot run — skip .exe on linux
        if (platform() !== 'win32' && p.endsWith('.exe')) continue
        return p
      }
    }
    return undefined
  }

  private isCliAvailable(): boolean {
    if (this.cliAvailableCache != null) return this.cliAvailableCache
    const bin = this.resolveCliBin()
    try {
      if (bin.endsWith('.mjs') || bin.endsWith('.js')) {
        execFileSync(process.execPath, [bin, '--version'], {
          timeout: 8000,
          stdio: 'ignore',
        })
      } else {
        execFileSync(bin, ['--version'], { timeout: 8000, stdio: 'ignore' })
      }
      this.cliAvailableCache = true
    } catch {
      try {
        execFileSync('npx', ['--yes', 'unlighthouse-ci', '--version'], {
          timeout: 20_000,
          stdio: 'ignore',
        })
        this.cliAvailableCache = true
        this.resolvedBinCache = 'npx'
      } catch {
        this.cliAvailableCache = false
      }
    }
    return this.cliAvailableCache
  }

  async run(payload: UnlighthouseJobPayload): Promise<NormalizedLabResult> {
    const useMock = this.shouldMock(payload) || payload.mock
    if (useMock) {
      this.logger.log(`Lab MOCK job=${payload.jobId} url=${payload.targetUrl}`)
      return normalizeUnlighthouseOutput({
        raw: buildMockUnlighthouseRaw(payload.targetUrl),
        targetUrl: payload.targetUrl,
        device: payload.device,
        mock: true,
        lighthouseVersion: 'mock',
      })
    }

    const started = Date.now()
    try {
      const result = await this.runCli(payload)
      this.logger.log(
        `Lab CLI OK job=${payload.jobId} durationMs=${Date.now() - started} url=${payload.targetUrl}`,
      )
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(
        `Unlighthouse CLI failed job=${payload.jobId} durationMs=${Date.now() - started}: ${message}`,
      )
      const fallback =
        this.configService.get<string>('UNLIGHTHOUSE_FALLBACK_MOCK') === 'true' ||
        this.configService.get<string>('UNLIGHTHOUSE_FALLBACK_MOCK') === '1' ||
        /enoent|not found|spawn/i.test(message)

      if (fallback) {
        this.logger.warn(`Lab FALLBACK mock job=${payload.jobId}`)
        return normalizeUnlighthouseOutput({
          raw: buildMockUnlighthouseRaw(payload.targetUrl),
          targetUrl: payload.targetUrl,
          device: payload.device,
          mock: true,
          lighthouseVersion: 'mock-fallback',
        })
      }
      throw error
    }
  }

  /**
   * Inside Docker, Nest cannot reach host FE via localhost:3000.
   * Rewrite to host.docker.internal (Docker Desktop / compose extra_hosts).
   */
  private rewriteTargetUrlForRuntime(url: string): string {
    try {
      const u = new URL(url)
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
        this.logger.log(`Rewrote scan URL host localhost → ${bridge} (Docker)`)
        return u.toString()
      }
    } catch {
      // keep original
    }
    return url
  }

  private assertNodeVersionForCli(): void {
    const major = Number(process.versions.node.split('.')[0])
    // fs.promises.glob (Unlighthouse 0.18) requires Node 22+
    if (major < 22) {
      throw new Error(
        `Unlighthouse 0.18 cần Node >= 22 (hiện tại v${process.versions.node} trong container). ` +
          `Rebuild image ladipage-backend từ Dockerfile (node:22-alpine).`,
      )
    }
  }

  private async runCli(payload: UnlighthouseJobPayload): Promise<NormalizedLabResult> {
    this.assertNodeVersionForCli()
    const bin = this.resolveCliBin()
    const chromePath = this.resolveChromePath()
    const outDir = await mkdtemp(join(tmpdir(), 'ai-seo-ulh-'))
    const defaultTimeout = payload.depth === 'full' ? 300_000 : 90_000
    const timeoutMs = Number(
      this.configService.get<string>('UNLIGHTHOUSE_TIMEOUT_MS') ?? defaultTimeout,
    )
    const effectiveTimeout = Math.min(Math.max(timeoutMs, 15_000), 300_000)

    try {
      const scanUrl = this.rewriteTargetUrlForRuntime(payload.targetUrl)
      const target = new URL(scanUrl)
      await this.assertTargetReachable(scanUrl, payload.targetUrl)
      const site = `${target.protocol}//${target.host}`
      const path = `${target.pathname || '/'}${target.search || ''}`

      const baseArgs = [
        '--site',
        site,
        '--urls',
        path.startsWith('/') ? path : `/${path}`,
        '--reporter',
        'jsonExpanded',
        '--output-path',
        outDir,
        '--samples',
        String(Math.max(1, Math.min(payload.samples, 3))),
        payload.device === 'desktop' ? '--desktop' : '--mobile',
        '--no-cache',
      ]

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        CI: '1',
        // Docker/Chromium headless without sandbox (Alpine container)
        PUPPETEER_ARGS: '--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage',
      }
      if (chromePath) {
        env.PUPPETEER_EXECUTABLE_PATH = chromePath
        env.CHROME_PATH = chromePath
        env.CHROMIUM_PATH = chromePath
      }

      this.logger.log(
        `Running ${bin} job=${payload.jobId} tenant=${payload.tenantId} ` +
          `url=${scanUrl} node=${process.versions.node} timeoutMs=${effectiveTimeout} ` +
          `chrome=${chromePath ?? '(puppeteer default)'}`,
      )

      if (bin === 'npx') {
        await execFileAsync('npx', ['--yes', 'unlighthouse-ci', ...baseArgs], {
          timeout: effectiveTimeout,
          maxBuffer: 20 * 1024 * 1024,
          env,
        })
      } else if (bin.endsWith('.mjs') || bin.endsWith('.js')) {
        await execFileAsync(process.execPath, [bin, ...baseArgs], {
          timeout: effectiveTimeout,
          maxBuffer: 20 * 1024 * 1024,
          env,
        })
      } else {
        try {
          await execFileAsync(bin, baseArgs, {
            timeout: effectiveTimeout,
            maxBuffer: 20 * 1024 * 1024,
            env,
          })
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          if (/enoent/i.test(msg)) {
            await execFileAsync('npx', ['--yes', 'unlighthouse-ci', ...baseArgs], {
              timeout: effectiveTimeout,
              maxBuffer: 20 * 1024 * 1024,
              env,
            })
          } else {
            throw err
          }
        }
      }

      const raw = await this.readReportJson(outDir)
      if (Array.isArray(raw) && raw.length === 0) {
        throw new Error(
          `Unlighthouse produced no JSON report (URL may be unreachable from Nest: ${payload.targetUrl})`,
        )
      }
      const normalized = normalizeUnlighthouseOutput({
        raw,
        targetUrl: payload.targetUrl,
        device: payload.device,
        mock: false,
        lighthouseVersion: null,
      })
      if (!hasAnyScore(normalized)) {
        this.logger.warn(
          `Unlighthouse report has no Lighthouse scores job=${payload.jobId} ` +
            `pagesScanned=${normalized.aggregate.pagesScanned} pagesFailed=${normalized.aggregate.pagesFailed}`,
        )
      }
      return normalized
    } finally {
      const keepReport =
        this.configService.get<string>('UNLIGHTHOUSE_DEBUG_KEEP_REPORT') === 'true' ||
        this.configService.get<string>('UNLIGHTHOUSE_DEBUG_KEEP_REPORT') === '1'
      if (keepReport) {
        this.logger.warn(`Keeping Unlighthouse debug output at ${outDir}`)
      } else {
        await rm(outDir, { recursive: true, force: true }).catch(() => undefined)
      }
    }
  }

  private async assertTargetReachable(scanUrl: string, originalUrl: string): Promise<void> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const response = await fetch(scanUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; LioraLabScan/1.0; +https://liora.local)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })
      if (!response.ok) {
        throw new Error(
          `Target URL unreachable before Unlighthouse: HTTP ${response.status} ${response.statusText} for ${scanUrl} (original ${originalUrl})`,
        )
      }
      const body = response.body as { cancel?: () => Promise<unknown> } | null
      await body?.cancel?.().catch(() => undefined)
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Target URL unreachable')) {
        throw error
      }
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Target URL unreachable before Unlighthouse: ${message} for ${scanUrl} (original ${originalUrl})`,
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  private async readReportJson(outDir: string): Promise<unknown> {
    let firstParsed: unknown | null = null
    const candidates = [
      join(outDir, 'ci-result.json'),
      join(outDir, 'payload.json'),
      join(outDir, 'reports', 'payload.json'),
    ]
    for (const file of candidates) {
      try {
        const text = await readFile(file, 'utf8')
        const raw = JSON.parse(text) as unknown
        firstParsed ??= raw
        if (hasLighthouseCategoriesAndAudits(raw)) return raw
        this.logger.warn(`Unlighthouse JSON has no Lighthouse report payload: ${file}`)
      } catch {
        // next
      }
    }
    try {
      const entries = await readdir(outDir, { withFileTypes: true })
      for (const e of entries) {
        if (e.isFile() && e.name.endsWith('.json')) {
          const text = await readFile(join(outDir, e.name), 'utf8')
          const raw = JSON.parse(text) as unknown
          firstParsed ??= raw
          if (hasLighthouseCategoriesAndAudits(raw)) return raw
          this.logger.warn(`Unlighthouse root JSON has no Lighthouse report payload: ${join(outDir, e.name)}`)
        }
      }
    } catch {
      // ignore
    }

    const lighthouseReports = await this.readLighthouseReports(outDir)
    if (lighthouseReports.length > 0) {
      this.logger.log(`Using ${lighthouseReports.length} nested Lighthouse report(s) from ${outDir}`)
      return { pages: lighthouseReports }
    }

    if (firstParsed != null) return firstParsed
    this.logger.warn(`No Unlighthouse JSON found under ${outDir}`)
    return []
  }

  private async readLighthouseReports(outDir: string): Promise<Array<Record<string, unknown>>> {
    const reports: Array<Record<string, unknown>> = []
    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > 6) return
      let entries
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        return
      }

      for (const entry of entries) {
        const file = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(file, depth + 1)
          continue
        }
        if (!entry.isFile() || entry.name !== 'lighthouse.json') continue

        try {
          const report = JSON.parse(await readFile(file, 'utf8')) as unknown
          if (!hasLighthouseCategoriesAndAudits(report)) {
            this.logger.warn(`Nested lighthouse.json has no categories/audits: ${file}`)
            continue
          }
          const r = objectFromUnknown(report) ?? {}
          reports.push({
            url: r.requestedUrl ?? r.finalUrl ?? r.finalDisplayedUrl,
            finalUrl: r.finalUrl ?? r.finalDisplayedUrl ?? r.requestedUrl,
            report,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          this.logger.warn(`Cannot read nested lighthouse.json ${file}: ${message}`)
        }
      }
    }

    await walk(outDir, 0)
    return reports
  }
}
