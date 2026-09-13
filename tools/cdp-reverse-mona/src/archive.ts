import type { BrowserContext, Page } from 'playwright';
import type { ArchiveDiscoveryResult, ArchiveRecord, MonaCrawlConfig } from './types.js';
import { archivePageNumber, isCandidateContentUrl, normalizeMonaUrl, uniqueOrdered } from './url.js';

interface ArchiveBrowserData {
  title: string;
  paginationUrls: string[];
  candidates: Array<{ url: string; text: string; score: number }>;
  links: Array<{ url: string; text: string }>;
  headings: Array<{ level: number; text: string }>;
  pageText: string;
}

const ARCHIVE_BROWSER_SCRIPT = String.raw`
() => {
  const paginationUrls = Array.from(document.querySelectorAll('a[href]'))
    .map((a) => a.href)
    .filter((href) => /\/blog\/page\/\d+\/?(?:$|[?#])/.test(href));

  const anchors = Array.from(document.querySelectorAll('a[href]'));
  const candidates = anchors
    .map((a) => {
      const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
      const inArticle = Boolean(a.closest('article'));
      const inPostish = Boolean(a.closest('[class*="post" i], [class*="blog" i], [class*="news" i]'));
      const heading = Boolean(a.closest('h1,h2,h3,h4') || a.querySelector('h1,h2,h3,h4'));
      const score = (inArticle ? 4 : 0) + (inPostish ? 2 : 0) + (heading ? 3 : 0) + (text.length >= 18 ? 2 : 0);
      return { url: a.href, text, score };
    })
    .filter((item) => item.score >= 4 && item.text.length > 0);

  const links = anchors.map((a) => ({
    url: a.href,
    text: (a.textContent || '').replace(/\s+/g, ' ').trim(),
  }));

  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .map((el) => ({
      level: Number(el.tagName.slice(1)),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
    }))
    .filter((item) => item.text);

  const pageText = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
  return { title: document.title, paginationUrls, candidates, links, headings, pageText };
}
`;

const ARCHIVE_BROWSER_FN = new Function(`return (${ARCHIVE_BROWSER_SCRIPT})`)() as () => ArchiveBrowserData;

export async function discoverFromArchive(
  context: BrowserContext,
  config: MonaCrawlConfig,
): Promise<ArchiveDiscoveryResult> {
  const firstPage = await context.newPage();
  firstPage.setDefaultNavigationTimeout(config.navigationTimeoutMs);

  let first: ArchiveRecord;
  try {
    first = await crawlArchivePage(firstPage, config.startUrl, config);
  } finally {
    await firstPage.close().catch(() => undefined);
  }

  let maxPage = Math.max(1, ...first.paginationUrls.map(extractArchivePageNumber));
  if (config.maxArchivePages > 0) maxPage = Math.min(maxPage, config.maxArchivePages);

  const records: ArchiveRecord[] = [first];
  let cursor = 2;
  const nextPageNumber = (): number | undefined => {
    if (cursor > maxPage) return undefined;
    const value = cursor;
    cursor += 1;
    return value;
  };

  const workerCount = Math.min(config.archiveConcurrency, Math.max(0, maxPage - 1));
  const workers = Array.from({ length: workerCount }, async (_, workerIndex) => {
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(config.navigationTimeoutMs);
    try {
      while (true) {
        const n = nextPageNumber();
        if (!n) break;
        const url = new URL(`/blog/page/${n}/`, config.baseUrl).toString();
        try {
          records.push(await crawlArchivePage(page, url, config));
        } catch (err) {
          console.warn(`[mona][archive][w${workerIndex + 1}] page ${n} failed: ${errorMessage(err)}`);
        }
        if (config.delayMs > 0) await page.waitForTimeout(Math.min(config.delayMs, 800));
      }
    } finally {
      await page.close().catch(() => undefined);
    }
  });
  await Promise.all(workers);

  records.sort((a, b) => a.pageNumber - b.pageNumber);
  const { urls, suppressedGlobalUrls } = filterArchiveCandidates(records);
  return { urls, records, maxPage, suppressedGlobalUrls };
}

export function filterArchiveCandidates(records: ArchiveRecord[]): {
  urls: string[];
  suppressedGlobalUrls: string[];
} {
  const pageFrequency = new Map<string, number>();
  const ordered: string[] = [];
  const seenOrdered = new Set<string>();

  for (const record of records) {
    const seenOnPage = new Set<string>();
    for (const item of record.articleCandidates) {
      if (!seenOrdered.has(item.url)) {
        seenOrdered.add(item.url);
        ordered.push(item.url);
      }
      seenOnPage.add(item.url);
    }
    for (const url of seenOnPage) {
      pageFrequency.set(url, (pageFrequency.get(url) ?? 0) + 1);
    }
  }

  // Header/footer/service links repeat across many archive pages. A real archive
  // article normally appears on only one page. Keep a generous threshold so
  // featured posts can repeat a few times without being dropped.
  const globalThreshold = Math.max(3, Math.ceil(records.length * 0.05));
  const suppressedGlobalUrls = ordered.filter((url) => (pageFrequency.get(url) ?? 0) > globalThreshold);
  const suppressed = new Set(suppressedGlobalUrls);
  const urls = ordered.filter((url) => !suppressed.has(url));
  return { urls, suppressedGlobalUrls };
}

async function crawlArchivePage(page: Page, url: string, config: MonaCrawlConfig): Promise<ArchiveRecord> {
  console.log(`[mona][archive] ${url}`);
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.navigationTimeoutMs });
  if (response && response.status() >= 400) throw new Error(`HTTP ${response.status()}`);
  await page.waitForTimeout(config.archiveSettleMs);

  const data = await page.evaluate(ARCHIVE_BROWSER_FN);
  const paginationUrls = uniqueOrdered(
    data.paginationUrls
      .map((href) => normalizeMonaUrl(href, config.baseUrl))
      .filter((href): href is string => Boolean(href)),
  );

  const seen = new Set<string>();
  const articleCandidates = data.candidates
    .map((item) => ({ ...item, url: normalizeMonaUrl(item.url, config.baseUrl) }))
    .filter((item): item is { url: string; text: string; score: number } => Boolean(item.url))
    .filter((item) => isCandidateContentUrl(item.url))
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .map(({ url: candidateUrl, text }) => ({ url: candidateUrl, text }));

  const links = data.links
    .map((item) => ({ ...item, url: normalizeMonaUrl(item.url, config.baseUrl) }))
    .filter((item): item is { url: string; text: string } => Boolean(item.url));

  return {
    url: page.url(),
    pageNumber: archivePageNumber(page.url()),
    title: data.title,
    fetchedAt: new Date().toISOString(),
    pageText: data.pageText,
    headings: data.headings,
    links,
    articleCandidates,
    paginationUrls,
    rawHtml: config.saveHtml ? await page.content() : undefined,
  };
}

function extractArchivePageNumber(url: string): number {
  const match = url.match(/\/blog\/page\/(\d+)\//);
  return match ? Number(match[1]) : 1;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
