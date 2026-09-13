import type { BrowserContext } from 'playwright';
import type { MonaCrawlConfig } from './types.js';
import { isCandidateContentUrl, normalizeMonaUrl, uniqueOrdered } from './url.js';

const LOC_RE = /<loc>\s*([^<]+?)\s*<\/loc>/gi;

export interface SitemapDiscoveryResult {
  urls: string[];
  fetchedSitemaps: string[];
  warnings: string[];
}

export async function discoverFromSitemap(
  context: BrowserContext,
  config: MonaCrawlConfig,
): Promise<SitemapDiscoveryResult> {
  const warnings: string[] = [];
  const fetchedSitemaps: string[] = [];
  if (!config.sitemapUrl) return { urls: [], fetchedSitemaps, warnings };

  const rootXml = await fetchText(context, config.sitemapUrl).catch((err: unknown) => {
    warnings.push(`Cannot read sitemap index: ${errorMessage(err)}`);
    return '';
  });
  if (!rootXml) return { urls: [], fetchedSitemaps, warnings };
  fetchedSitemaps.push(config.sitemapUrl);

  const rootLocs = extractLocs(rootXml);
  const childSitemaps = rootLocs.filter((loc) => /sitemap.*\.xml(?:$|\?)/i.test(loc) || /-sitemap\d*\.xml(?:$|\?)/i.test(loc));
  const directPages = rootLocs.filter((loc) => !childSitemaps.includes(loc));

  let selected = childSitemaps.filter((loc) => /(?:^|\/)(?:post|posts)-sitemap\d*\.xml/i.test(loc));
  if (selected.length === 0) selected = childSitemaps.slice(0, 80);

  const collected: string[] = [];
  for (const direct of directPages) {
    const normalized = normalizeMonaUrl(decodeXml(direct), config.baseUrl);
    if (normalized && isCandidateContentUrl(normalized)) collected.push(normalized);
  }

  for (const sitemapUrl of selected) {
    try {
      const xml = await fetchText(context, sitemapUrl);
      fetchedSitemaps.push(sitemapUrl);
      for (const loc of extractLocs(xml)) {
        const normalized = normalizeMonaUrl(decodeXml(loc), config.baseUrl);
        if (normalized && isCandidateContentUrl(normalized)) collected.push(normalized);
      }
    } catch (err) {
      warnings.push(`Cannot read ${sitemapUrl}: ${errorMessage(err)}`);
    }
  }

  return { urls: uniqueOrdered(collected), fetchedSitemaps, warnings };
}

async function fetchText(context: BrowserContext, url: string): Promise<string> {
  const response = await context.request.get(url, {
    headers: { accept: 'application/xml,text/xml,text/plain,*/*' },
    timeout: 30_000,
    failOnStatusCode: false,
  });
  if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
  return response.text();
}

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  for (const match of xml.matchAll(LOC_RE)) {
    const value = match[1]?.trim();
    if (value) out.push(value);
  }
  return out;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
