import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { toStrapiReady } from './strapi.js';
import type {
  ArchiveRecord,
  CrawlErrorRecord,
  CrawlSummary,
  MonaArticleRecord,
  MonaCrawlConfig,
  NetworkCaptureEntry,
} from './types.js';

const OUTPUT_SCHEMA_VERSION = 4;
const CRAWLER_VERSION = '4.0.0-strapi';

interface CompletedLine {
  url: string;
  status: 'article' | 'skipped';
  at: string;
}

interface OutputMeta {
  schemaVersion: number;
  crawlerVersion: string;
  createdAt: string;
}

export class MonaOutput {
  readonly dir: string;
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly config: MonaCrawlConfig) {
    this.dir = resolve(config.outputDir);
  }

  async prepare(): Promise<Set<string>> {
    if (!this.config.resume) await rm(this.dir, { recursive: true, force: true });

    const existing = await readdir(this.dir).catch(() => [] as string[]);
    const metaPath = join(this.dir, 'crawler-meta.json');
    const meta = await readFile(metaPath, 'utf8')
      .then((raw) => JSON.parse(raw) as OutputMeta)
      .catch(() => undefined);

    if (this.config.resume && existing.length > 0) {
      if (!meta) {
        throw new Error(
          `Existing output at ${this.dir} was not created by this crawler. Run once with --no-resume or use a new --output directory.`,
        );
      }
      if (meta.schemaVersion !== OUTPUT_SCHEMA_VERSION) {
        throw new Error(
          `Output schema ${meta.schemaVersion} is incompatible with schema ${OUTPUT_SCHEMA_VERSION}. Use --no-resume or a new output directory.`,
        );
      }
    }

    await mkdir(join(this.dir, 'html'), { recursive: true });
    await mkdir(join(this.dir, 'archive-html'), { recursive: true });
    if (!meta) {
      const nextMeta: OutputMeta = {
        schemaVersion: OUTPUT_SCHEMA_VERSION,
        crawlerVersion: CRAWLER_VERSION,
        createdAt: new Date().toISOString(),
      };
      await writeFile(metaPath, JSON.stringify(nextMeta, null, 2), 'utf8');
    }

    const completed = new Set<string>();
    if (this.config.resume) {
      const content = await readFile(join(this.dir, 'completed.jsonl'), 'utf8').catch(() => '');
      for (const line of content.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const item = JSON.parse(line) as CompletedLine;
          if (item.url) completed.add(item.url);
        } catch {
          // Ignore a partial final line after an interrupted run.
        }
      }
    }
    return completed;
  }

  writeArchives(records: ArchiveRecord[]): Promise<void> {
    return this.enqueue(async () => {
      const lines: string[] = [];
      for (const record of records) {
        const { rawHtml, ...persisted } = record;
        if (rawHtml && this.config.saveHtml) {
          const filename = `blog-page-${String(record.pageNumber).padStart(3, '0')}.html`;
          await writeFile(join(this.dir, 'archive-html', filename), rawHtml, 'utf8');
          persisted.rawHtmlPath = `archive-html/${filename}`;
        }
        lines.push(JSON.stringify(persisted));
      }
      const payload = lines.length > 0 ? lines.join('\n') + '\n' : '';
      await writeFile(join(this.dir, 'archives.jsonl'), payload, 'utf8');
    });
  }

  appendArticle(record: MonaArticleRecord): Promise<void> {
    return this.enqueue(async () => {
      await appendFile(join(this.dir, 'articles.jsonl'), JSON.stringify(record) + '\n', 'utf8');
      await appendFile(join(this.dir, 'strapi-ready.jsonl'), JSON.stringify(toStrapiReady(record)) + '\n', 'utf8');
      const completed: CompletedLine = { url: record.requestedUrl, status: 'article', at: new Date().toISOString() };
      await appendFile(join(this.dir, 'completed.jsonl'), JSON.stringify(completed) + '\n', 'utf8');
    });
  }

  appendSkipped(url: string, reason: string, signals: string[]): Promise<void> {
    return this.enqueue(async () => {
      await appendFile(
        join(this.dir, 'skipped.jsonl'),
        JSON.stringify({ url, reason, signals, at: new Date().toISOString() }) + '\n',
        'utf8',
      );
      const completed: CompletedLine = { url, status: 'skipped', at: new Date().toISOString() };
      await appendFile(join(this.dir, 'completed.jsonl'), JSON.stringify(completed) + '\n', 'utf8');
    });
  }

  appendError(record: CrawlErrorRecord): Promise<void> {
    return this.appendJsonl('errors.jsonl', record);
  }

  appendNetwork(pageUrl: string, entries: NetworkCaptureEntry[]): Promise<void> {
    if (entries.length === 0) return Promise.resolve();
    return this.enqueue(async () => {
      const payload = entries.map((entry) => JSON.stringify({ crawlPageUrl: pageUrl, ...entry })).join('\n') + '\n';
      await appendFile(join(this.dir, 'network.jsonl'), payload, 'utf8');
    });
  }

  async saveHtml(url: string, html: string): Promise<string> {
    const path = new URL(url).pathname;
    const slug = sanitizeFilename(basename(path.replace(/\/$/, '')) || 'index').slice(0, 80);
    const hash = createHash('sha1').update(url).digest('hex').slice(0, 10);
    const filename = `${slug || 'page'}-${hash}.html`;
    const relative = join('html', filename);
    await writeFile(join(this.dir, relative), html, 'utf8');
    return relative.replaceAll('\\', '/');
  }

  async writeUrls(urls: string[], meta: Record<string, unknown>): Promise<void> {
    await writeFile(join(this.dir, 'urls.json'), JSON.stringify({ ...meta, count: urls.length, urls }, null, 2), 'utf8');
  }

  async writeSummary(summary: CrawlSummary, config: MonaCrawlConfig): Promise<void> {
    await this.chain;
    await writeFile(join(this.dir, 'summary.json'), JSON.stringify({ summary, config }, null, 2), 'utf8');
  }

  async writeProgress(progress: Record<string, unknown>): Promise<void> {
    return this.enqueue(async () => {
      const tmp = join(this.dir, 'progress.json.tmp');
      const dest = join(this.dir, 'progress.json');
      await writeFile(tmp, JSON.stringify(progress, null, 2), 'utf8');
      await rm(dest, { force: true });
      await rename(tmp, dest);
    });
  }

  private appendJsonl(filename: string, value: unknown): Promise<void> {
    return this.enqueue(() => appendFile(join(this.dir, filename), JSON.stringify(value) + '\n', 'utf8'));
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    this.chain = this.chain.then(task, task);
    return this.chain;
  }
}

function sanitizeFilename(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
