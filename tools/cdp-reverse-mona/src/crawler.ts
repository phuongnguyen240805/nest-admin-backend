import { chromium, type BrowserContext } from 'playwright';
import { discoverFromArchive } from './archive.js';
import { extractMonaPage, scrollArticlePage } from './extractor.js';
import { MonaNetworkCollector } from './network.js';
import { MonaOutput } from './output.js';
import { discoverFromSitemap } from './sitemap.js';
import type { CrawlSummary, MonaArticleRecord, MonaCrawlConfig } from './types.js';
import { normalizeMonaUrl, uniqueOrdered } from './url.js';

interface Counters {
  attempted: number;
  articles: number;
  skipped: number;
  errors: number;
}

export async function runMonaCrawl(config: MonaCrawlConfig): Promise<CrawlSummary> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const output = new MonaOutput(config);
  const completed = await output.prepare();

  console.log('[mona] launching Chromium...');
  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    userAgent: config.userAgent,
    locale: 'vi-VN',
    extraHTTPHeaders: {
      'accept-language': 'vi-VN,vi;q=0.9,en;q=0.7',
    },
  });

  if (config.blockHeavyResources) {
    await context.route('**/*', async (route) => {
      const type = route.request().resourceType();
      if (type === 'font' || type === 'media' || type === 'image') {
        await route.abort();
      } else {
        await route.continue();
      }
    });
  }

  try {
    console.log('[mona] discovery: sitemap + blog archives');
    const sitemapPromise = config.discoverFromSitemap
      ? discoverFromSitemap(context, config)
      : Promise.resolve({ urls: [], fetchedSitemaps: [], warnings: [] });
    const archivePromise = config.discoverFromArchive
      ? discoverFromArchive(context, config)
      : Promise.resolve({ urls: [], records: [], maxPage: 0, suppressedGlobalUrls: [] });

    const [sitemap, archive] = await Promise.all([sitemapPromise, archivePromise]);
    for (const warning of sitemap.warnings) console.warn(`[mona][sitemap] ${warning}`);
    await output.writeArchives(archive.records);

    // High-confidence candidates appear in both the rendered blog archive and
    // post sitemap. Archive-only URLs come next for newly published content, then
    // sitemap-only URLs fill gaps. This ordering makes smoke tests article-first.
    const sitemapSet = new Set(sitemap.urls);
    const archiveSet = new Set(archive.urls);
    const archiveVerified = archive.urls.filter((url) => sitemapSet.has(url));
    const archiveOnly = archive.urls.filter((url) => !sitemapSet.has(url));
    const sitemapOnly = sitemap.urls.filter((url) => !archiveSet.has(url));

    const allCandidates = uniqueOrdered([...archiveVerified, ...archiveOnly, ...sitemapOnly])
      .map((url) => normalizeMonaUrl(url, config.baseUrl))
      .filter((url): url is string => Boolean(url));

    await output.writeUrls(allCandidates, {
      generatedAt: new Date().toISOString(),
      archivePages: archive.records.length,
      archiveMaxPage: archive.maxPage,
      archiveCandidatesFiltered: archive.urls.length,
      archiveSuppressedGlobals: archive.suppressedGlobalUrls.length,
      archiveVerifiedBySitemap: archiveVerified.length,
      archiveOnly: archiveOnly.length,
      sitemapOnly: sitemapOnly.length,
      sitemapCandidates: sitemap.urls.length,
      fetchedSitemaps: sitemap.fetchedSitemaps,
    });

    const pending = allCandidates.filter((url) => !completed.has(url));
    console.log(
      `[mona] candidates=${allCandidates.length} | completed=${completed.size} | pending=${pending.length} | workers=${config.concurrency}`,
    );

    const counters: Counters = { attempted: 0, articles: 0, skipped: 0, errors: 0 };
    const canonicalSeen = new Set<string>();
    let cursor = 0;

    const nextUrl = (): string | undefined => {
      if (config.maxArticles > 0 && counters.articles >= config.maxArticles) return undefined;
      if (config.maxAttempts > 0 && counters.attempted >= config.maxAttempts) return undefined;
      const url = pending[cursor];
      cursor += 1;
      return url;
    };

    const workerCount = Math.min(config.concurrency, Math.max(1, pending.length));
    const workers = Array.from({ length: workerCount }, (_, i) =>
      runWorker(i + 1, context, config, output, nextUrl, canonicalSeen, counters, async () => {
        if (counters.attempted % 10 === 0 || cursor >= pending.length) {
          await output.writeProgress({
            at: new Date().toISOString(),
            totalCandidates: allCandidates.length,
            totalPendingAtStart: pending.length,
            targetArticles: config.maxArticles || null,
            maxAttempts: config.maxAttempts || null,
            ...counters,
          });
        }
      }),
    );
    await Promise.all(workers);

    const summary: CrawlSummary = {
      startedAt,
      finishedAt: new Date().toISOString(),
      startUrl: config.startUrl,
      discoveredFromArchive: archive.urls.length,
      discoveredFromSitemap: sitemap.urls.length,
      suppressedArchiveGlobals: archive.suppressedGlobalUrls.length,
      uniqueCandidates: allCandidates.length,
      alreadyCompleted: allCandidates.filter((url) => completed.has(url)).length,
      attempted: counters.attempted,
      articles: counters.articles,
      skippedNonArticles: counters.skipped,
      errors: counters.errors,
      durationMs: Date.now() - startedMs,
    };
    await output.writeSummary(summary, config);
    return summary;
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

async function runWorker(
  workerId: number,
  context: BrowserContext,
  config: MonaCrawlConfig,
  output: MonaOutput,
  nextUrl: () => string | undefined,
  canonicalSeen: Set<string>,
  counters: Counters,
  onProgress: () => Promise<void>,
): Promise<void> {
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(config.navigationTimeoutMs);
  const cdp = await context.newCDPSession(page);
  const network = new MonaNetworkCollector(
    cdp,
    config.networkBodyBytes,
    config.captureNetwork,
    config.captureAllNetworkMetadata,
  );
  await network.attach();

  try {
    while (true) {
      const url = nextUrl();
      if (!url) break;
      counters.attempted += 1;
      const ordinal = counters.attempted;
      console.log(`[mona][w${workerId}] ${ordinal}: ${url}`);

      let lastError: unknown;
      let finished = false;
      for (let attempt = 1; attempt <= config.retries + 1; attempt += 1) {
        const t0 = Date.now();
        network.beginPage(url);
        try {
          const response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: config.navigationTimeoutMs,
          });
          const status = response?.status();
          if (status && [408, 425, 429, 500, 502, 503, 504].includes(status)) {
            throw new Error(`HTTP ${status}`);
          }
          if (status && status >= 400) throw new Error(`HTTP ${status}`);

          await page.waitForLoadState('networkidle', { timeout: 3500 }).catch(() => undefined);
          if (config.scrollArticle) await scrollArticlePage(page).catch(() => undefined);
          await page.waitForTimeout(config.articleSettleMs);

          const extracted = await extractMonaPage(page, url, config.baseUrl);
          await network.waitForIdle(1200);
          const networkEntries = network.entriesForCurrentPage();
          await output.appendNetwork(url, networkEntries);

          if (!extracted.isArticle) {
            counters.skipped += 1;
            await output.appendSkipped(url, 'Not enough article signals', extracted.articleSignals);
            console.log(`[mona][w${workerId}] skip: ${url} [${extracted.articleSignals.join(', ')}]`);
            finished = true;
            break;
          }

          const canonical = normalizeMonaUrl(extracted.canonicalUrl, config.baseUrl) ?? extracted.canonicalUrl;
          if (canonicalSeen.has(canonical) && canonical !== url) {
            counters.skipped += 1;
            await output.appendSkipped(url, `Duplicate canonical: ${canonical}`, extracted.articleSignals);
            finished = true;
            break;
          }
          canonicalSeen.add(canonical);

          let rawHtmlPath: string | undefined;
          if (config.saveHtml) rawHtmlPath = await output.saveHtml(canonical, await page.content());

          const article: MonaArticleRecord = {
            ...extracted,
            canonicalUrl: canonical,
            crawl: {
              crawledAt: new Date().toISOString(),
              workerId,
              httpStatus: status,
              durationMs: Date.now() - t0,
              rawHtmlPath,
              networkEntries: networkEntries.length,
            },
          };
          await output.appendArticle(article);
          counters.articles += 1;
          console.log(`[mona][w${workerId}] OK ${article.title} (${article.wordCount} words)`);
          finished = true;
          break;
        } catch (err) {
          lastError = err;
          console.warn(
            `[mona][w${workerId}] attempt ${attempt}/${config.retries + 1} failed ${url}: ${errorMessage(err)}`,
          );
          if (attempt <= config.retries) {
            await page.waitForTimeout(Math.min(5000, 700 * 2 ** (attempt - 1)));
          }
        }
      }

      if (!finished) {
        counters.errors += 1;
        await output.appendError({
          url,
          at: new Date().toISOString(),
          attempts: config.retries + 1,
          message: errorMessage(lastError),
        });
      }

      await onProgress();
      if (config.delayMs > 0) await page.waitForTimeout(config.delayMs);
    }
  } finally {
    await cdp.detach().catch(() => undefined);
    await page.close().catch(() => undefined);
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? 'Unknown error');
}
