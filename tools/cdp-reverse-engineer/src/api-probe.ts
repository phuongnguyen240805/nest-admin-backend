#!/usr/bin/env node
/**
 * Probe detail/mutation API paths bằng session đã login.
 * Dùng khi UI headless không trigger order/show, product/show.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { buildSchemaDraft } from './exporters/schema-exporter.js';
import { buildLadipageFlow } from './exporters/ladipage-flow.js';
import type { LadipageEndpoint } from './exporters/ladipage-flow.js';
import { resolveStorageStatePath } from './browser-session.js';
import { nowIso } from './utils.js';

const STORAGE = '.session/ladipage-appv6-auth.json';
const MERGED = 'output/merged/ladipage-post-apis.json';

interface ProbeSpec {
  host: string;
  path: string;
  body: Record<string, unknown>;
  label: string;
}

function extractIds(posts: LadipageEndpoint[]): {
  orderId?: number;
  productId?: number;
  pageId?: string;
  storeId?: string;
  auth?: string;
  ownerId?: string;
} {
  const out: ReturnType<typeof extractIds> = {};

  for (const ep of posts) {
    const h = ep.requestHeaders ?? {};
    if (!out.auth && (h.authorization || h.Authorization)) {
      out.auth = (h.authorization ?? h.Authorization) as string;
    }
    if (!out.ownerId && h['owner-id']) out.ownerId = h['owner-id'];
    if (!out.storeId && h['store-id']) out.storeId = h['store-id'];

    const data = (ep.responseBody as { data?: Record<string, unknown> })?.data;
    if (!data) continue;

    const orders = data.orders as Array<{ order_id?: number }> | undefined;
    if (!out.orderId && Array.isArray(orders) && orders[0]?.order_id) {
      out.orderId = orders[0].order_id;
    }

    const products = data.products as Array<{ product_id?: number }> | undefined;
    if (!out.productId && Array.isArray(products) && products[0]?.product_id) {
      out.productId = products[0].product_id;
    }

    const items = data.items as Array<{ _id?: string }> | undefined;
    if (!out.pageId && Array.isArray(items) && items[0]?._id) {
      out.pageId = items[0]._id;
    }

    const ladipage = data.ladipage as { _id?: string } | undefined;
    if (!out.pageId && ladipage?._id) out.pageId = ladipage._id;
  }

  return out;
}

function buildProbes(ids: ReturnType<typeof extractIds>): ProbeSpec[] {
  const probes: ProbeSpec[] = [];
  const lang = { lang: 'vi' };

  if (ids.orderId) {
    const oid = ids.orderId;
    const orderBodies = [
      { order_id: oid },
      { id: oid },
      { orderId: oid },
    ];
    const orderPaths = [
      'show',
      'show-order',
      'get-order',
      'detail',
      'info',
      'get-detail',
      'list-order-item',
      'list-order-items',
      'get-order-items',
    ];
    for (const path of orderPaths) {
      for (const body of orderBodies) {
        probes.push({
          host: 'apiv5.sales.ldpform.net',
          path: `/2.0/order/${path}`,
          body: { ...lang, ...body },
          label: `order/${path}`,
        });
      }
    }
  }

  if (ids.productId) {
    const pid = ids.productId;
    const productBodies = [
      { product_id: pid },
      { id: pid },
      { productId: pid },
    ];
    const productPaths = ['show', 'show-product', 'get-product', 'detail', 'info', 'get-detail'];
    for (const path of productPaths) {
      for (const body of productBodies) {
        probes.push({
          host: 'apiv5.sales.ldpform.net',
          path: `/2.0/product/${path}`,
          body: { ...lang, ...body },
          label: `product/${path}`,
        });
      }
    }
  }

  if (ids.pageId) {
    probes.push({
      host: 'apiv5.ladipage.com',
      path: '/2.0/ladi-page/show',
      body: { id: ids.pageId, lang: 'vi', type: 'LADIPAGE' },
      label: 'ladi-page/show (probe)',
    });
  }

  return probes;
}

async function main(): Promise<void> {
  const mergedPath = resolve(MERGED);
  const posts = JSON.parse(await readFile(mergedPath, 'utf8')) as LadipageEndpoint[];
  const ids = extractIds(posts);
  const probes = buildProbes(ids);

  console.log('[probe] IDs:', ids);
  console.log(`[probe] ${probes.length} candidate requests`);

  const storage = resolveStorageStatePath(STORAGE)!;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: storage });
  const request = context.request;

  const hits: LadipageEndpoint[] = [];
  const errors: Array<{ probe: string; status: number; message?: string }> = [];

  for (const probe of probes) {
    const url = `https://${probe.host}${probe.path}`;
    try {
      const headers: Record<string, string> = {
        accept: 'application/json',
        'content-type': 'application/json;charset=UTF-8',
      };
      if (ids.auth) headers.authorization = ids.auth;
      if (ids.storeId) headers['store-id'] = ids.storeId;
      if (ids.ownerId) headers['owner-id'] = ids.ownerId;

      const res = await request.post(url, { data: probe.body, headers, timeout: 15_000 });
      const status = res.status();
      let responseBody: unknown;
      try {
        responseBody = await res.json();
      } catch {
        responseBody = await res.text();
      }

      const code = (responseBody as { code?: number })?.code;
      const hasData =
        responseBody &&
        typeof responseBody === 'object' &&
        'data' in (responseBody as object) &&
        (responseBody as { data?: unknown }).data !== null &&
        (responseBody as { data?: unknown }).data !== undefined;

      if (status === 200 && (code === undefined || code === 200) && hasData) {
        const data = (responseBody as { data: unknown }).data;
        const empty =
          data === null ||
          (Array.isArray(data) && data.length === 0) ||
          (typeof data === 'object' &&
            data !== null &&
            Object.values(data as Record<string, unknown>).every(
              (v) => v === null || v === undefined || (Array.isArray(v) && v.length === 0),
            ));

        if (!empty) {
          console.log(`[probe] ✓ ${probe.label} → ${probe.path}`);
          hits.push({
            method: 'POST',
            host: probe.host,
            path: probe.path,
            url,
            status,
            requestBody: probe.body,
            responseBody,
            requestHeaders: headers,
            timestamp: nowIso(),
          });
        }
      } else if (status !== 404 && status !== 405) {
        errors.push({
          probe: probe.label,
          status,
          message: (responseBody as { message?: string })?.message,
        });
      }
    } catch (err) {
      errors.push({ probe: probe.label, status: 0, message: String(err) });
    }
  }

  await browser.close();

  const stamp = nowIso().replace(/[:.]/g, '-');
  const outDir = join(resolve('output/api-probe'), stamp);
  await mkdir(outDir, { recursive: true });

  await writeFile(join(outDir, 'probe-hits.json'), JSON.stringify(hits, null, 2), 'utf8');
  await writeFile(join(outDir, 'probe-errors-sample.json'), JSON.stringify(errors.slice(0, 50), null, 2), 'utf8');
  await writeFile(join(outDir, 'extracted-ids.json'), JSON.stringify(ids, null, 2), 'utf8');

  if (hits.length > 0) {
    const flow = buildLadipageFlow(
      hits.map((h) => ({
        id: h.path,
        method: h.method,
        url: h.url,
        path: h.path,
        host: h.host,
        status: h.status,
        requestHeaders: h.requestHeaders,
        responseHeaders: {},
        requestBody: h.requestBody,
        responseBody: h.responseBody,
        timestamp: h.timestamp,
      })),
      [],
      { url: 'api-probe', finalUrl: 'api-probe', pageTitle: 'api-probe' },
    );
    await writeFile(join(outDir, 'ladipage-post-apis.json'), JSON.stringify(hits, null, 2), 'utf8');
    await writeFile(join(outDir, 'ladipage-flow.json'), JSON.stringify(flow, null, 2), 'utf8');
    await writeFile(join(outDir, 'schema-draft.json'), JSON.stringify(buildSchemaDraft(hits), null, 2), 'utf8');
  }

  console.log(`\n[probe] Done: ${hits.length} hits, ${errors.length} misses → ${outDir}`);
}

main().catch((err) => {
  console.error('[probe] failed:', err);
  process.exit(1);
});