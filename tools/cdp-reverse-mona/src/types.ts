export interface MonaCrawlConfig {
  startUrl: string;
  baseUrl: string;
  sitemapUrl?: string;
  outputDir: string;
  headless: boolean;
  concurrency: number;
  archiveConcurrency: number;
  maxArchivePages: number;
  maxArticles: number;
  maxAttempts: number;
  navigationTimeoutMs: number;
  archiveSettleMs: number;
  articleSettleMs: number;
  delayMs: number;
  retries: number;
  resume: boolean;
  discoverFromSitemap: boolean;
  discoverFromArchive: boolean;
  saveHtml: boolean;
  captureNetwork: boolean;
  captureAllNetworkMetadata: boolean;
  networkBodyBytes: number;
  blockHeavyResources: boolean;
  scrollArticle: boolean;
  userAgent: string;
}

export interface ArchiveLink {
  url: string;
  text: string;
}

export interface ArchiveRecord {
  url: string;
  pageNumber: number;
  title: string;
  fetchedAt: string;
  pageText: string;
  headings: Array<{ level: number; text: string }>;
  links: ArchiveLink[];
  articleCandidates: ArchiveLink[];
  paginationUrls: string[];
  rawHtml?: string;
  rawHtmlPath?: string;
}

export interface ArchiveDiscoveryResult {
  urls: string[];
  records: ArchiveRecord[];
  maxPage: number;
  suppressedGlobalUrls: string[];
}

export interface MetaTagMap {
  [key: string]: string[];
}

export interface ArticleHeading {
  level: number;
  text: string;
  id?: string;
}

export interface ArticleImage {
  src: string;
  srcset?: string;
  sizes?: string;
  alt?: string;
  title?: string;
  caption?: string;
  width?: number;
  height?: number;
  loading?: string;
}

export interface ArticleLink {
  url: string;
  text: string;
  rel?: string;
  target?: string;
  internal: boolean;
}

export interface ArticleMedia {
  type: 'video' | 'audio' | 'iframe' | 'source';
  src: string;
  title?: string;
}

export interface ArticleTable {
  headers: string[];
  rows: string[][];
}

export interface BreadcrumbItem {
  name: string;
  url?: string;
}

export interface NetworkCaptureEntry {
  requestId: string;
  pageUrl: string;
  resourceType: string;
  method: string;
  url: string;
  status?: number;
  mimeType?: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody?: unknown;
  responseBody?: unknown;
  startedAt: string;
  durationMs?: number;
  failed?: string;
}

export interface MonaPageExtraction {
  requestedUrl: string;
  finalUrl: string;
  canonicalUrl: string;
  isArticle: boolean;
  articleSignals: string[];
  lang?: string;
  documentTitle: string;
  title: string;
  description?: string;
  keywords: string[];
  robots?: string;
  publishedAt?: string;
  modifiedAt?: string;
  authors: string[];
  categories: string[];
  tags: string[];
  metaTags: MetaTagMap;
  openGraph: Record<string, string[]>;
  twitter: Record<string, string[]>;
  jsonLd: unknown[];
  breadcrumbs: BreadcrumbItem[];
  contentHtml: string;
  contentText: string;
  wordCount: number;
  headings: ArticleHeading[];
  images: ArticleImage[];
  links: ArticleLink[];
  media: ArticleMedia[];
  tables: ArticleTable[];
}

export interface MonaArticleRecord extends MonaPageExtraction {
  crawl: {
    crawledAt: string;
    workerId: number;
    httpStatus?: number;
    durationMs: number;
    rawHtmlPath?: string;
    networkEntries: number;
  };
}

export interface CrawlErrorRecord {
  url: string;
  at: string;
  attempts: number;
  message: string;
}

export interface CrawlSummary {
  startedAt: string;
  finishedAt: string;
  startUrl: string;
  discoveredFromArchive: number;
  discoveredFromSitemap: number;
  suppressedArchiveGlobals: number;
  uniqueCandidates: number;
  alreadyCompleted: number;
  attempted: number;
  articles: number;
  skippedNonArticles: number;
  errors: number;
  durationMs: number;
}
