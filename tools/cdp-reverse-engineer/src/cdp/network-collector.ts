import type { CDPSession } from 'playwright';
import type { ApiEntry } from '../types.js';
import { matchService, nowIso, parseUrlParts, safeJsonParse, truncate } from '../utils.js';
import type { ServicePattern } from '../types.js';

interface PendingRequest {
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody?: unknown;
  startedAt: number;
  service?: string;
}

export class NetworkCollector {
  private pending = new Map<string, PendingRequest>();
  readonly apis: ApiEntry[] = [];

  constructor(
    private readonly patterns: ServicePattern[],
    private readonly maxBodyBytes: number,
  ) {}

  async attach(cdp: CDPSession): Promise<void> {
    await cdp.send('Network.enable', {
      maxTotalBufferSize: 50_000_000,
      maxResourceBufferSize: 10_000_000,
      maxPostDataSize: this.maxBodyBytes,
    });
    await cdp.send('Fetch.enable', {
      patterns: [{ urlPattern: '*', requestStage: 'Request' }],
    });

    cdp.on('Network.requestWillBeSent', (evt) => {
      const headers: Record<string, string> = {
        ...(evt.request.headers as Record<string, string> | undefined),
      };

      const body = evt.request.postData
        ? safeJsonParse(truncate(evt.request.postData, this.maxBodyBytes))
        : undefined;

      this.pending.set(evt.requestId, {
        method: evt.request.method,
        url: evt.request.url,
        requestHeaders: headers,
        requestBody: body,
        startedAt: Date.now(),
        service: matchService(evt.request.url, this.patterns, 'url'),
      });
    });

    cdp.on('Network.responseReceived', (evt) => {
      const req = this.pending.get(evt.requestId);
      if (!req) return;
      (req as PendingRequest & { status?: number; mimeType?: string; responseHeaders?: Record<string, string> }).status =
        evt.response.status;
      (req as PendingRequest & { mimeType?: string }).mimeType = evt.response.mimeType;
      const rh: Record<string, string> = {};
      if (evt.response.headers) Object.assign(rh, evt.response.headers as Record<string, string>);
      (req as PendingRequest & { responseHeaders?: Record<string, string> }).responseHeaders = rh;
    });

    const finalize = async (requestId: string, failed?: string) => {
      const req = this.pending.get(requestId);
      if (!req) return;

      let responseBody: unknown;
      if (!failed) {
        try {
          const body = await cdp.send('Network.getResponseBody', { requestId });
          const raw = body.base64Encoded
            ? Buffer.from(body.body, 'base64').toString('utf8')
            : body.body;
          responseBody = safeJsonParse(truncate(raw, this.maxBodyBytes));
        } catch {
          responseBody = undefined;
        }
      }

      const { host, path } = parseUrlParts(req.url);
      const extra = req as PendingRequest & {
        status?: number;
        mimeType?: string;
        responseHeaders?: Record<string, string>;
      };

      this.apis.push({
        id: requestId,
        method: req.method,
        url: req.url,
        host,
        path,
        status: failed ? 0 : extra.status,
        mimeType: extra.mimeType,
        requestHeaders: req.requestHeaders,
        responseHeaders: extra.responseHeaders ?? {},
        requestBody: req.requestBody,
        responseBody: failed ? { error: failed } : responseBody,
        timingMs: Date.now() - req.startedAt,
        service: req.service,
        timestamp: nowIso(),
      });

      this.pending.delete(requestId);
    };

    cdp.on('Network.loadingFinished', (evt) => {
      void finalize(evt.requestId);
    });

    cdp.on('Network.loadingFailed', (evt) => {
      void finalize(evt.requestId, evt.errorText);
    });

    cdp.on('Fetch.requestPaused', async (evt) => {
      try {
        await cdp.send('Fetch.continueRequest', { requestId: evt.requestId });
      } catch {
        /* page may have closed */
      }
    });
  }
}