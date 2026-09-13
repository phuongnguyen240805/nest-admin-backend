import type { CDPSession } from 'playwright';
import type { NetworkCaptureEntry } from './types.js';

interface Pending {
  requestId: string;
  pageUrl: string;
  resourceType: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody?: unknown;
  startedAt: number;
  startedAtIso: string;
  status?: number;
  mimeType?: string;
  responseHeaders?: Record<string, string>;
}

const API_CAPTURE_TYPES = new Set(['Document', 'XHR', 'Fetch']);

export class MonaNetworkCollector {
  private pending = new Map<string, Pending>();
  private entries: NetworkCaptureEntry[] = [];
  private currentPageUrl = '';

  constructor(
    private readonly cdp: CDPSession,
    private readonly maxBodyBytes: number,
    private readonly enabled: boolean,
    private readonly captureAllMetadata: boolean,
  ) {}

  async attach(): Promise<void> {
    if (!this.enabled) return;
    await this.cdp.send('Network.enable', {
      maxTotalBufferSize: 20_000_000,
      maxResourceBufferSize: 4_000_000,
      maxPostDataSize: this.maxBodyBytes,
    });

    this.cdp.on('Network.requestWillBeSent', (evt: any) => {
      const resourceType = String(evt.type ?? 'Other');
      if (!this.captureAllMetadata && !API_CAPTURE_TYPES.has(resourceType)) return;
      const rawBody = evt.request.postData;
      this.pending.set(evt.requestId, {
        requestId: evt.requestId,
        pageUrl: this.currentPageUrl,
        resourceType,
        method: evt.request.method,
        url: evt.request.url,
        requestHeaders: sanitizeHeaders(evt.request.headers as Record<string, string>),
        requestBody: rawBody ? parseMaybeJson(truncate(rawBody, this.maxBodyBytes)) : undefined,
        startedAt: Date.now(),
        startedAtIso: new Date().toISOString(),
      });
    });

    this.cdp.on('Network.responseReceived', (evt: any) => {
      const req = this.pending.get(evt.requestId);
      if (!req) return;
      req.status = evt.response.status;
      req.mimeType = evt.response.mimeType;
      req.responseHeaders = sanitizeHeaders(evt.response.headers as Record<string, string>);
    });

    this.cdp.on('Network.loadingFinished', (evt: any) => {
      void this.finalize(evt.requestId);
    });
    this.cdp.on('Network.loadingFailed', (evt: any) => {
      void this.finalize(evt.requestId, evt.errorText);
    });
  }

  beginPage(pageUrl: string): void {
    this.currentPageUrl = pageUrl;
    this.entries = [];
  }

  entriesForCurrentPage(): NetworkCaptureEntry[] {
    return this.entries.filter((entry) => entry.pageUrl === this.currentPageUrl);
  }

  async waitForIdle(timeoutMs = 1500): Promise<void> {
    if (!this.enabled) return;
    const deadline = Date.now() + timeoutMs;
    while (this.pending.size > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  private async finalize(requestId: string, failed?: string): Promise<void> {
    const req = this.pending.get(requestId);
    if (!req) return;
    this.pending.delete(requestId);

    let responseBody: unknown;
    if (!failed && shouldCaptureBody(req.resourceType, req.mimeType, req.responseHeaders)) {
      try {
        const body = await this.cdp.send('Network.getResponseBody', { requestId });
        const raw = body.base64Encoded ? Buffer.from(body.body, 'base64').toString('utf8') : body.body;
        responseBody = parseMaybeJson(truncate(raw, this.maxBodyBytes));
      } catch {
        responseBody = undefined;
      }
    }

    this.entries.push({
      requestId: req.requestId,
      pageUrl: req.pageUrl,
      resourceType: req.resourceType,
      method: req.method,
      url: req.url,
      status: failed ? 0 : req.status,
      mimeType: req.mimeType,
      requestHeaders: req.requestHeaders,
      responseHeaders: req.responseHeaders ?? {},
      requestBody: req.requestBody,
      responseBody,
      startedAt: req.startedAtIso,
      durationMs: Date.now() - req.startedAt,
      failed,
    });
  }
}

function shouldCaptureBody(type: string, mimeType?: string, headers?: Record<string, string>): boolean {
  if (type !== 'XHR' && type !== 'Fetch') return false;
  const contentType = mimeType ?? headers?.['content-type'] ?? '';
  return /json|graphql|text\//i.test(contentType);
}

function sanitizeHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (/^(cookie|set-cookie|authorization|proxy-authorization|x-api-key)$/i.test(lower)) continue;
    if (['content-type', 'accept', 'origin', 'referer', 'cache-control', 'etag', 'last-modified', 'content-length'].includes(lower)) {
      out[lower] = String(value);
    }
  }
  return out;
}

function parseMaybeJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function truncate(value: string, maxBytes: number): string {
  const buffer = Buffer.from(value, 'utf8');
  if (buffer.length <= maxBytes) return value;
  return buffer.subarray(0, maxBytes).toString('utf8');
}
