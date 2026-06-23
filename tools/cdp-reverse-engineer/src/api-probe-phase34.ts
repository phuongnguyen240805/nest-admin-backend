#!/usr/bin/env node
/**
 * Probe CRM (Phase 3) + Analytics/Reports (Phase 4) API paths trên nhiều host LadiPage.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { buildSchemaDraft } from './exporters/schema-exporter.js';
import { resolveStorageStatePath } from './browser-session.js';
import { nowIso } from './utils.js';
import type { LadipageEndpoint } from './exporters/ladipage-flow.js';

const STORAGE = '.session/ladipage-appv6-auth.json';
const MERGED = 'output/merged/ladipage-post-apis.json';

/** Fallback IDs từ capture Phase 2/3 (trial account) */
const FALLBACK_CTX = {
  customerId: 13427358,
  pageId: '6a37eb9931cd7400125f766f',
};

const LADIFLOW_HOST = 'api.ladiflow.com';

const CRM_HOSTS = [
  LADIFLOW_HOST,
  'api.ladipage.com',
  'apiv5.ladipage.com',
  'apiv5.sales.ldpform.net',
];

const REPORT_HOSTS = ['api.ladipage.com', 'apiv5.ladipage.com', 'apiv5.sales.ldpform.net'];

interface ProbeSpec {
  host: string;
  path: string;
  body: Record<string, unknown>;
  label: string;
  phase: 'crm' | 'report';
}

function extractContext(posts: LadipageEndpoint[]): {
  customerId?: number;
  pageId?: string;
  storeId?: string;
  auth?: string;
  ownerId?: string;
} {
  const out: ReturnType<typeof extractContext> = {};
  for (const ep of posts) {
    const h = ep.requestHeaders ?? {};
    if (!out.auth && (h.authorization || h.Authorization)) {
      out.auth = (h.authorization ?? h.Authorization) as string;
    }
    if (!out.ownerId && h['owner-id']) out.ownerId = h['owner-id'];
    if (!out.storeId && h['store-id']) out.storeId = h['store-id'];

    const req = ep.requestBody as Record<string, unknown> | undefined;
    if (!out.customerId && req?.customer_id) out.customerId = Number(req.customer_id);

    const data = (ep.responseBody as { data?: Record<string, unknown> })?.data;
    if (!data) continue;

    const customer = data.customer as { customer_id?: number } | undefined;
    if (!out.customerId && customer?.customer_id) out.customerId = customer.customer_id;

    const customers = data.customers as Array<{ customer_id?: number }> | undefined;
    if (!out.customerId && Array.isArray(customers) && customers[0]?.customer_id) {
      out.customerId = customers[0].customer_id;
    }

    const items = data.items as Array<{ _id?: string }> | undefined;
    if (!out.pageId && Array.isArray(items) && items[0]?._id) out.pageId = items[0]._id;

    const ladipage = data.ladipage as { _id?: string } | undefined;
    if (!out.pageId && ladipage?._id) out.pageId = ladipage._id;
  }
  return out;
}

function buildCrmProbes(ctx: ReturnType<typeof extractContext>): ProbeSpec[] {
  const probes: ProbeSpec[] = [];
  const lang = { lang: 'vi' };
  const listBodies = [
    { ...lang, paged: 1, limit: 20 },
    { ...lang, page: 1, limit: 20 },
    { ...lang },
  ];

  const ladiflowCrm: Array<{ resource: string; actions: string[] }> = [
    { resource: 'customer', actions: ['list', 'list-customer-merge', 'search'] },
    { resource: 'customer-tag', actions: ['list', 'list-all'] },
    { resource: 'segment', actions: ['list'] },
    { resource: 'custom-field', actions: ['list-all', 'list'] },
    { resource: 'crm-organization', actions: ['list'] },
    { resource: 'sync-error', actions: ['list'] },
  ];

  for (const { resource, actions } of ladiflowCrm) {
    for (const action of actions) {
      for (const body of listBodies) {
        probes.push({
          host: LADIFLOW_HOST,
          path: `/1.0/${resource}/${action}`,
          body,
          label: `${resource}/${action}@ladiflow`,
          phase: 'crm',
        });
      }
    }
  }

  const customerId = ctx.customerId ?? FALLBACK_CTX.customerId;
  for (const action of ['show', 'get', 'detail', 'activity', 'customer-detail']) {
    probes.push({
      host: LADIFLOW_HOST,
      path: `/1.0/customer/${action}`,
      body: { ...lang, customer_id: customerId },
      label: `customer/${action}@ladiflow`,
      phase: 'crm',
    });
    if (['show', 'get', 'detail'].includes(action)) {
      probes.push({
        host: 'apiv5.sales.ldpform.net',
        path: `/2.0/customer/${action}`,
        body: { ...lang, customer_id: customerId },
        label: `customer/${action}@sales`,
        phase: 'crm',
      });
    }
  }

  const ladiflowDashboard: Array<{ resource: string; actions: string[] }> = [
    { resource: 'dash-board', actions: ['list-subscriber-by-time', 'summary'] },
    { resource: 'crm-insight-folder', actions: ['list'] },
    { resource: 'broadcast', actions: ['list'] },
  ];
  for (const { resource, actions } of ladiflowDashboard) {
    for (const action of actions) {
      for (const body of listBodies) {
        probes.push({
          host: LADIFLOW_HOST,
          path: `/1.0/${resource}/${action}`,
          body,
          label: `${resource}/${action}@ladiflow`,
          phase: 'report',
        });
      }
    }
  }

  return probes;
}

function buildReportProbes(ctx: ReturnType<typeof extractContext>): ProbeSpec[] {
  const probes: ProbeSpec[] = [];
  const lang = { lang: 'vi' };
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);

  const dateRange = {
    from_date: `${from} 00:00:00 +07:00`,
    to_date: `${to} 23:59:59 +07:00`,
  };

  const reportBodies = [
    { ...lang, ...dateRange },
    { ...lang, range: '30d' },
    { ...lang, days: 30 },
    { ...lang },
  ];

  const reportActions = [
    'overview',
    'top-product',
    'top-products',
    'sales',
    'order-summary',
    'conversion',
    'customers',
    'revenue',
    'summary',
  ];

  for (const host of REPORT_HOSTS) {
    for (const action of reportActions) {
      for (const body of reportBodies) {
        probes.push({
          host,
          path: `/2.0/report/${action}`,
          body,
          label: `report/${action}@${host}`,
          phase: 'report',
        });
      }
    }
    for (const body of reportBodies) {
      probes.push({
        host,
        path: '/2.0/dashboard/summary',
        body,
        label: `dashboard/summary@${host}`,
        phase: 'report',
      });
      probes.push({
        host,
        path: '/2.0/analytics/summary',
        body,
        label: `analytics/summary@${host}`,
        phase: 'report',
      });
    }
    const pageId = ctx.pageId ?? FALLBACK_CTX.pageId;
    for (const body of reportBodies) {
      probes.push({
        host,
        path: '/2.0/ladi-page/report',
        body: { ...body, id: pageId, type: 'LADIPAGE', page_id: pageId },
        label: `ladi-page/report@${host}`,
        phase: 'report',
      });
      probes.push({
        host,
        path: '/2.0/ladi-page/analytics',
        body: { ...body, id: pageId, type: 'LADIPAGE' },
        label: `ladi-page/analytics@${host}`,
        phase: 'report',
      });
    }
  }

  return probes;
}

async function runProbes(
  probes: ProbeSpec[],
  ctx: ReturnType<typeof extractContext>,
): Promise<{ hits: LadipageEndpoint[]; errors: Array<{ probe: string; status: number; message?: string }> }> {
  const storage = resolveStorageStatePath(STORAGE)!;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: storage });
  const request = context.request;

  const hits: LadipageEndpoint[] = [];
  const seen = new Set<string>();
  const errors: Array<{ probe: string; status: number; message?: string }> = [];

  for (const probe of probes) {
    const key = `${probe.host}${probe.path}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const url = `https://${probe.host}${probe.path}`;
    try {
      const headers: Record<string, string> = {
        accept: 'application/json',
        'content-type': 'application/json;charset=UTF-8',
      };
      if (ctx.auth) headers.authorization = ctx.auth;
      if (ctx.storeId) headers['store-id'] = ctx.storeId;
      if (ctx.ownerId) headers['owner-id'] = ctx.ownerId;

      const res = await request.post(url, { data: probe.body, headers, timeout: 12_000 });
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
              (v) =>
                v === null ||
                v === undefined ||
                v === 0 ||
                v === '' ||
                (Array.isArray(v) && v.length === 0),
            ));

        if (!empty) {
          console.log(`[probe-p34] ✓ [${probe.phase}] ${probe.label}`);
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
      } else if (status !== 404 && status !== 405 && status !== 0) {
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
  return { hits, errors };
}

async function main(): Promise<void> {
  const mergedPath = resolve(MERGED);
  const posts = JSON.parse(await readFile(mergedPath, 'utf8')) as LadipageEndpoint[];
  const ctx = extractContext(posts);

  const crmProbes = buildCrmProbes(ctx);
  const reportProbes = buildReportProbes(ctx);
  const allProbes = [...crmProbes, ...reportProbes];

  console.log('[probe-p34] Context:', ctx);
  console.log(`[probe-p34] ${crmProbes.length} CRM + ${reportProbes.length} report probes`);

  const { hits, errors } = await runProbes(allProbes, ctx);

  const stamp = nowIso().replace(/[:.]/g, '-');
  const outDir = join(resolve('output/api-probe-phase34'), stamp);
  await mkdir(outDir, { recursive: true });

  await writeFile(join(outDir, 'probe-hits.json'), JSON.stringify(hits, null, 2), 'utf8');
  await writeFile(join(outDir, 'probe-errors-sample.json'), JSON.stringify(errors.slice(0, 80), null, 2), 'utf8');
  await writeFile(join(outDir, 'extracted-context.json'), JSON.stringify(ctx, null, 2), 'utf8');

  if (hits.length > 0) {
    await writeFile(join(outDir, 'ladipage-post-apis.json'), JSON.stringify(hits, null, 2), 'utf8');
    await writeFile(join(outDir, 'schema-draft.json'), JSON.stringify(buildSchemaDraft(hits), null, 2), 'utf8');
  }

  const crmHits = hits.filter((h) => h.path.includes('customer') || h.path.includes('segment') || h.path.includes('person') || h.path.includes('company') || h.path.includes('sync'));
  const reportHits = hits.filter((h) => h.path.includes('report') || h.path.includes('dashboard') || h.path.includes('analytics'));

  console.log(`\n[probe-p34] Done: ${hits.length} hits (crm: ${crmHits.length}, report: ${reportHits.length})`);
  console.log(`  misses: ${errors.length} → ${outDir}`);
}

main().catch((err) => {
  console.error('[probe-p34] failed:', err);
  process.exit(1);
});