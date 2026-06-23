#!/usr/bin/env node
/**
 * Probe LadiWork (Phase B) + Automation/LadiFlow (Phase C) routes trên api.ladiflow.com.
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
const LADIFLOW = 'api.ladiflow.com';
const LADIFLOW_V5 = 'apiv5.ladiflow.com';
const LADIPAGE = 'api.ladipage.com';

const FALLBACK = {
  pipelineId: '6a3a8d71da6cd800128221ee',
  stageId: '6a3a8d71da6cd800128221f2',
  dealId: '6a3a8eafda6cd800128266cf',
  flowId: '6a3a8bd0da6cd8001281cbd2',
};

interface ProbeSpec {
  host: string;
  path: string;
  body: Record<string, unknown>;
  label: string;
  phase: 'ladiwork' | 'automation' | 'appstore';
}

function extractContext(posts: LadipageEndpoint[]): {
  auth?: string;
  ownerId?: string;
  storeId?: string;
  pipelineId?: string;
  stageId?: string;
  dealId?: string;
  flowId?: string;
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
    if (!out.pipelineId && req?.pipeline_id) out.pipelineId = String(req.pipeline_id);
    if (!out.stageId && req?.pipeline_stage_id) out.stageId = String(req.pipeline_stage_id);
    if (!out.dealId && (req?.deal_id || req?._id)) out.dealId = String(req.deal_id ?? req._id);

    const data = (ep.responseBody as { data?: Record<string, unknown> })?.data;
    if (!data) continue;

    const items = data.items as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(items) && items[0]) {
      const it = items[0];
      if (ep.path.includes('crm-deal') && it._id && !out.dealId) out.dealId = String(it._id);
      if (ep.path.includes('crm-pipeline') && it._id && !out.pipelineId) {
        out.pipelineId = String(it._id);
        const stages = it.stages as Array<{ _id?: string }> | undefined;
        if (stages?.[0]?._id && !out.stageId) out.stageId = stages[0]._id;
      }
      if (ep.path.includes('flow/list') && it._id && !out.flowId) out.flowId = String(it._id);
    }
  }
  return out;
}

function buildProbes(ctx: ReturnType<typeof extractContext>): ProbeSpec[] {
  const lang = { lang: 'vi' };
  const pipelineId = ctx.pipelineId ?? FALLBACK.pipelineId;
  const stageId = ctx.stageId ?? FALLBACK.stageId;
  const dealId = ctx.dealId ?? FALLBACK.dealId;
  const flowId = ctx.flowId ?? FALLBACK.flowId;

  const probes: ProbeSpec[] = [];

  const lwPaths: Array<{ path: string; body: Record<string, unknown>; label: string }> = [
    { path: '/1.0/crm-deal/show', body: { ...lang, deal_id: dealId }, label: 'crm-deal/show' },
    { path: '/1.0/crm-deal/list', body: { ...lang, pipeline_id: pipelineId, pipeline_stage_id: stageId, page: 1, limit: 20 }, label: 'crm-deal/list-stage' },
    { path: '/1.0/crm-deal/activity', body: { ...lang, deal_id: dealId, page: 1, limit: 20 }, label: 'crm-deal/activity' },
    { path: '/1.0/crm-deal-comment/list', body: { ...lang, deal_id: dealId, page: 1, limit: 20 }, label: 'crm-deal-comment/list' },
    { path: '/1.0/crm-deal-file/list', body: { ...lang, deal_id: dealId, page: 1, limit: 20 }, label: 'crm-deal-file/list' },
    { path: '/1.0/crm-pipeline/show', body: { ...lang, pipeline_id: pipelineId }, label: 'crm-pipeline/show' },
    { path: '/1.0/crm-label/list', body: { ...lang, page: 1, limit: 100 }, label: 'crm-label/list' },
    { path: '/1.0/ladiwork-dashboard/overview', body: lang, label: 'ladiwork-dashboard/overview' },
    { path: '/1.0/ladiwork-dashboard/deal-timeline', body: { ...lang, deal_id: dealId }, label: 'ladiwork-dashboard/deal-timeline' },
  ];

  for (const p of lwPaths) {
    probes.push({ host: LADIFLOW, ...p, phase: 'ladiwork' });
  }

  const autoPaths: Array<{ path: string; body: Record<string, unknown>; label: string; host?: string }> = [
    { path: '/1.0/flow/show', body: { ...lang, flow_id: flowId, _id: flowId }, label: 'flow/show@apiv5', host: LADIFLOW_V5 },
    { path: '/1.0/flow/show', body: { ...lang, flow_id: flowId }, label: 'flow/show' },
    { path: '/1.0/flow/detail', body: { ...lang, flow_id: flowId }, label: 'flow/detail' },
    { path: '/1.0/flow/get', body: { ...lang, _id: flowId }, label: 'flow/get' },
    { path: '/1.0/recurring-topic/list', body: { ...lang, page: 1, limit: 20 }, label: 'recurring-topic/list@apiv5', host: LADIFLOW_V5 },
    { path: '/1.0/segment/list-all', body: lang, label: 'segment/list-all@apiv5', host: LADIFLOW_V5 },
    { path: '/1.0/flow/list', body: { ...lang, search: { name: '' }, page: 1, limit: 10, sort: { _id: 'DESC' } }, label: 'flow/list' },
    { path: '/1.0/broadcast/show', body: { ...lang, page: 1, limit: 10 }, label: 'broadcast/show' },
    { path: '/1.0/broadcast/list', body: { ...lang, page: 1, limit: 10 }, label: 'broadcast/list' },
    { path: '/1.0/trigger/list', body: { ...lang, page: 1, limit: 50 }, label: 'trigger/list' },
    { path: '/1.0/action/list', body: { ...lang, page: 1, limit: 50 }, label: 'action/list' },
    { path: '/1.0/automation/list', body: { ...lang, page: 1, limit: 10 }, label: 'automation/list' },
    { path: '/1.0/flow-template/list', body: { ...lang, page: 1, limit: 10 }, label: 'flow-template/list' },
  ];

  for (const p of autoPaths) {
    probes.push({ host: p.host ?? LADIFLOW, path: p.path, body: p.body, label: p.label, phase: 'automation' });
  }

  const appPaths = [
    { path: '/2.0/application/show', body: { ...lang, code: 'LadiWork' }, label: 'application/show' },
    { path: '/2.0/application/show', body: { ...lang, code: 'Automation' }, label: 'application/show-automation' },
    { path: '/2.0/application/search', body: { ...lang, keyword: 'LadiWork' }, label: 'application/search' },
  ];
  for (const p of appPaths) {
    probes.push({ host: LADIPAGE, ...p, phase: 'appstore' });
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
    const key = `${probe.host}${probe.path}:${probe.label}`;
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
          console.log(`[probe-bc] ✓ [${probe.phase}] ${probe.label}`);
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
        } else {
          errors.push({ probe: probe.label, status, message: 'empty data' });
        }
      } else if (status !== 404 && status !== 405) {
        errors.push({
          probe: probe.label,
          status,
          message: (responseBody as { message?: string })?.message ?? String(code),
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
  const probes = buildProbes(ctx);

  console.log('[probe-bc] Context:', { ...ctx, auth: ctx.auth ? '(set)' : undefined });
  console.log(`[probe-bc] ${probes.length} probes (ladiwork + automation + appstore)`);

  const { hits, errors } = await runProbes(probes, ctx);

  const stamp = nowIso().replace(/[:.]/g, '-');
  const outDir = join(resolve('output/api-probe-phaseBC'), stamp);
  await mkdir(outDir, { recursive: true });

  await writeFile(join(outDir, 'probe-hits.json'), JSON.stringify(hits, null, 2), 'utf8');
  await writeFile(join(outDir, 'probe-errors-sample.json'), JSON.stringify(errors.slice(0, 100), null, 2), 'utf8');
  await writeFile(join(outDir, 'extracted-context.json'), JSON.stringify(ctx, null, 2), 'utf8');

  if (hits.length > 0) {
    await writeFile(join(outDir, 'ladipage-post-apis.json'), JSON.stringify(hits, null, 2), 'utf8');
    await writeFile(join(outDir, 'schema-draft.json'), JSON.stringify(buildSchemaDraft(hits), null, 2), 'utf8');
  }

  const lw = hits.filter((h) => h.path.includes('crm') || h.path.includes('ladiwork'));
  const auto = hits.filter((h) => h.path.includes('flow') || h.path.includes('broadcast') || h.path.includes('trigger') || h.path.includes('automation'));

  console.log(`\n[probe-bc] Done: ${hits.length} hits (ladiwork: ${lw.length}, automation: ${auto.length})`);
  console.log(`  misses: ${errors.length} → ${outDir}`);
}

main().catch((err) => {
  console.error('[probe-bc] failed:', err);
  process.exit(1);
});