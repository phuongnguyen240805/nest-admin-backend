import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { MonaCrawlConfig } from './types.js';

const DEFAULT_CONFIG: MonaCrawlConfig = {
  startUrl: 'https://mona.media/blog/',
  baseUrl: 'https://mona.media',
  sitemapUrl: 'https://mona.media/sitemap_index.xml',
  outputDir: 'output/mona',
  headless: true,
  concurrency: 2,
  archiveConcurrency: 3,
  maxArchivePages: 0,
  maxArticles: 0,
  maxAttempts: 0,
  navigationTimeoutMs: 45_000,
  archiveSettleMs: 500,
  articleSettleMs: 700,
  delayMs: 300,
  retries: 2,
  resume: true,
  discoverFromSitemap: true,
  discoverFromArchive: true,
  saveHtml: true,
  captureNetwork: true,
  captureAllNetworkMetadata: false,
  networkBodyBytes: 1_048_576,
  blockHeavyResources: true,
  scrollArticle: true,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 MonaResearchCDP/3.0',
};

function parseArgv(argv: string[]) {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const has = (flag: string) => argv.includes(flag);
  return { get, has };
}

export async function loadMonaConfig(argv: string[]): Promise<MonaCrawlConfig> {
  const { get, has } = parseArgv(argv);
  const configPath = get('--config');
  let fileConfig: Partial<MonaCrawlConfig> = {};

  if (configPath) {
    fileConfig = JSON.parse(await readFile(resolve(configPath), 'utf8')) as Partial<MonaCrawlConfig>;
  }

  const config: MonaCrawlConfig = { ...DEFAULT_CONFIG, ...fileConfig };

  if (get('--url')) config.startUrl = get('--url')!;
  if (get('--output')) config.outputDir = get('--output')!;
  if (get('--concurrency')) config.concurrency = Number(get('--concurrency'));
  if (get('--archive-concurrency')) config.archiveConcurrency = Number(get('--archive-concurrency'));
  if (get('--limit')) config.maxArticles = Number(get('--limit'));
  if (get('--max-attempts')) config.maxAttempts = Number(get('--max-attempts'));
  if (get('--archive-pages')) config.maxArchivePages = Number(get('--archive-pages'));
  if (get('--delay')) config.delayMs = Number(get('--delay'));
  if (has('--headed')) config.headless = false;
  if (has('--headless')) config.headless = true;
  if (has('--no-resume')) config.resume = false;
  if (has('--no-sitemap')) config.discoverFromSitemap = false;
  if (has('--no-archive')) config.discoverFromArchive = false;
  if (has('--no-network')) config.captureNetwork = false;
  if (has('--all-network-metadata')) config.captureAllNetworkMetadata = true;
  if (has('--api-network-only')) config.captureAllNetworkMetadata = false;
  if (has('--no-html')) config.saveHtml = false;
  if (has('--load-media')) config.blockHeavyResources = false;

  config.concurrency = clampInt(config.concurrency, 1, 8, 2);
  config.archiveConcurrency = clampInt(config.archiveConcurrency, 1, 6, 3);
  config.maxArchivePages = nonNegativeInt(config.maxArchivePages);
  config.maxArticles = nonNegativeInt(config.maxArticles);
  config.maxAttempts = nonNegativeInt(config.maxAttempts);
  config.delayMs = nonNegativeInt(config.delayMs);
  config.retries = clampInt(config.retries, 0, 5, 2);
  config.networkBodyBytes = clampInt(config.networkBodyBytes, 16_384, 8_388_608, 1_048_576);

  const start = new URL(config.startUrl);
  const base = new URL(config.baseUrl);
  if (start.hostname !== base.hostname) {
    throw new Error(`startUrl (${start.hostname}) must use the same host as baseUrl (${base.hostname})`);
  }

  return config;
}

function nonNegativeInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
