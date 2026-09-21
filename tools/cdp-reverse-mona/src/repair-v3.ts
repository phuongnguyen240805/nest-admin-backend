#!/usr/bin/env node
import { createReadStream } from 'node:fs';
import { mkdir, writeFile, appendFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { load } from 'cheerio';
import type { ArticleHeading, HeadingCounts, MonaArticleRecord, StrapiReadyRecord } from './types.js';

interface LegacyArticle extends Partial<MonaArticleRecord> {
  requestedUrl?: string;
  finalUrl?: string;
  canonicalUrl?: string;
  title?: string;
  description?: string;
  contentHtml?: string;
  publishedAt?: string;
  modifiedAt?: string;
  authors?: string[];
  categories?: string[];
  tags?: string[];
  keywords?: string[];
  robots?: string;
  crawl?: MonaArticleRecord['crawl'];
}

const args = process.argv.slice(2);
const input = resolve(valueAfter('--input') ?? 'output/mona/articles.jsonl');
const output = resolve(valueAfter('--output') ?? 'output/strapi-repaired.jsonl');
const errorOutput = output.replace(/\.jsonl$/i, '.errors.jsonl');

await mkdir(dirname(output), { recursive: true });
await rm(output, { force: true });
await rm(errorOutput, { force: true });

let total = 0;
let repaired = 0;
let failed = 0;
const reader = createInterface({ input: createReadStream(input, { encoding: 'utf8' }), crlfDelay: Infinity });

for await (const line of reader) {
  if (!line.trim()) continue;
  total += 1;
  try {
    const legacy = JSON.parse(line) as LegacyArticle;
    const ready = repairRecord(legacy);
    await appendFile(output, JSON.stringify(ready) + '\n', 'utf8');
    repaired += 1;
  } catch (err) {
    failed += 1;
    await appendFile(
      errorOutput,
      JSON.stringify({ line: total, message: err instanceof Error ? err.message : String(err) }) + '\n',
      'utf8',
    );
  }
}

const summary = { input, output, total, repaired, failed, finishedAt: new Date().toISOString() };
await writeFile(output.replace(/\.jsonl$/i, '.summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify(summary, null, 2));

function repairRecord(record: LegacyArticle): StrapiReadyRecord {
  const canonicalUrl = record.canonicalUrl || record.finalUrl || record.requestedUrl;
  if (!canonicalUrl) throw new Error('Missing canonical/source URL');
  if (!record.contentHtml) throw new Error(`Missing contentHtml: ${canonicalUrl}`);

  const $ = load(record.contentHtml, {}, false);
  let root = $('.mona-content.blogContent').first();
  if (!root.length) root = $('.blogContent').first();
  if (!root.length) root = $('.mona-content').first();
  if (!root.length) throw new Error(`Cannot find article body root: ${canonicalUrl}`);

  root
    .find(
      [
        'script',
        'style',
        'noscript',
        'svg',
        'form',
        'button',
        'input',
        'textarea',
        'select',
        '[class*="social-share"]',
        '[class*="related-post"]',
        '[class*="related-article"]',
        '[class*="newsletter"]',
        '.mona-entity-anchor',
        '.mona-pod-inbody',
        '.mona-pod-cta',
        '.js-cta-card',
      ].join(','),
    )
    .remove();

  root.find('*').each((_: number, el: any) => {
    const attribs = { ...(el.attribs ?? {}) } as Record<string, string>;
    for (const name of Object.keys(attribs)) {
      if (/^on/i.test(name)) $(el).removeAttr(name);
    }
    for (const name of ['href', 'src', 'poster']) {
      const value = $(el).attr(name);
      if (!value) continue;
      try {
        $(el).attr(name, new URL(value, canonicalUrl).toString());
      } catch {
        // Keep malformed source value for manual review rather than dropping content.
      }
    }
  });

  root.find('h1').each((_: number, el: any) => {
    const attrs = { ...(el.attribs ?? {}) } as Record<string, string>;
    const inner = $(el).html() ?? '';
    const h2 = $('<h2></h2>').html(inner);
    for (const [key, value] of Object.entries(attrs)) h2.attr(key, value);
    $(el).replaceWith(h2);
  });

  const headings: ArticleHeading[] = [];
  const counts: HeadingCounts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  root.find('h1,h2,h3,h4,h5,h6').each((_: number, el: any) => {
    const level = Number(String(el.tagName || el.name).slice(1));
    const text = cleanText($(el).text());
    if (!text || level < 1 || level > 6) return;
    headings.push({ level, text, id: $(el).attr('id') || undefined });
    const key = `h${level}` as keyof HeadingCounts;
    counts[key] += 1;
  });

  const contentHtml = (root.html() ?? '').trim();
  if (cleanText(root.text()).length < 300) throw new Error(`Article body too short after cleanup: ${canonicalUrl}`);

  const title = decodeEntities(record.title ?? '').trim();
  if (!title) throw new Error(`Missing title: ${canonicalUrl}`);

  return {
    source: {
      requestedUrl: record.requestedUrl || canonicalUrl,
      canonicalUrl,
      crawledAt: record.crawl?.crawledAt || new Date().toISOString(),
    },
    data: {
      title,
      slug: slugFromUrl(canonicalUrl),
      excerpt: decodeEntities(record.description ?? '').trim() || undefined,
      contentHtml,
      publishedAt: record.publishedAt,
      sourceModifiedAt: record.modifiedAt,
      authors: record.authors ?? [],
      categories: record.categories ?? [],
      tags: record.tags ?? [],
      headings,
      headingCounts: counts,
      images: [],
      seo: {
        metaTitle: title,
        metaDescription: decodeEntities(record.description ?? '').trim() || undefined,
        canonicalUrl,
        robots: record.robots,
        keywords: record.keywords ?? [],
      },
    },
  };
}

function cleanText(value: string): string {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function decodeEntities(value: string): string {
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
}

function slugFromUrl(url: string): string {
  const parts = new URL(url).pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'article';
}

function valueAfter(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
