#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface CapturedPostApi {
  method: string;
  host: string;
  path: string;
  status?: number;
  requestBody?: unknown;
  responseBody?: unknown;
  requestHeaders?: Record<string, unknown>;
  timestamp?: string;
}

interface ContractFixture {
  route: string;
  host: string;
  path: string;
  status?: number;
  request: unknown;
  response: unknown;
  requestHeaders?: Record<string, unknown>;
  capturedAt?: string;
}

function parseRouteFilter(argv: string[]): Set<string> | null {
  const direct = argv.find((arg) => arg.startsWith('--routes='));
  const nextIndex = argv.findIndex((arg) => arg === '--routes');
  const raw = direct?.slice('--routes='.length) ?? (nextIndex >= 0 ? argv[nextIndex + 1] : undefined);
  if (!raw) return null;
  return new Set(
    raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function routeKey(api: CapturedPostApi): string {
  return api.path.replace(/^\/(?:1|2)\.0\//, '');
}

function fixtureFileName(route: string): string {
  return `${route.replace(/\//g, '__')}.json`;
}

function phaseFolder(api: CapturedPostApi): string {
  const route = routeKey(api);
  if (api.host === 'api.ladipage.com' && route.startsWith('application/')) return 'phaseA';
  if (
    api.host === 'api.ladiflow.com' &&
    (
      route.startsWith('ladiwork-dashboard/') ||
      route.startsWith('crm-pipeline/') ||
      route.startsWith('crm-pipeline-category/') ||
      route.startsWith('crm-deal/') ||
      route.startsWith('crm-deal-custom-field/') ||
      route.startsWith('crm-filter/') ||
      route.startsWith('crm-label/') ||
      route.startsWith('crm-organization/') ||
      route.startsWith('crm-staff-configuration/')
    )
  ) {
    return 'phaseB';
  }
  if (
    (api.host === 'api.ladiflow.com' || api.host === 'apiv5.ladiflow.com') &&
    (
      route.startsWith('flow/') ||
      route.startsWith('flow-tag/') ||
      route.startsWith('integration/') ||
      route.startsWith('broadcast/') ||
      route.startsWith('recurring-topic/') ||
      route === 'customer-tag/list-all' ||
      route === 'segment/list-all'
    )
  ) {
    return 'phaseC';
  }
  if (api.host === 'api.ladiflow.com') return 'phase3';
  if (route.startsWith('report/')) return 'phase4';
  if (
    route.startsWith('order/') ||
    route.startsWith('product/') ||
    route.startsWith('checkout') ||
    route.startsWith('payment/') ||
    route.startsWith('shipping/')
  ) {
    return 'phase2';
  }
  return 'phase1';
}

function isValidFixture(api: CapturedPostApi): boolean {
  if (api.status !== 200) return false;
  if (!api.responseBody || typeof api.responseBody !== 'object') return false;
  const code = (api.responseBody as { code?: number }).code;
  return code === 200;
}

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const toolRoot = resolve(scriptDir, '..');
  const workspaceRoot = resolve(toolRoot, '../..');
  const inputPath = join(toolRoot, 'output/merged/ladipage-post-apis.json');
  const outputRoot = join(workspaceRoot, 'apps/ladipage-backend/test/contract/fixtures');
  const routeFilter = parseRouteFilter(process.argv.slice(2));
  const apis = JSON.parse(await readFile(inputPath, 'utf8')) as CapturedPostApi[];

  const emitted: string[] = [];
  for (const api of apis) {
    if (api.method !== 'POST') continue;
    const key = routeKey(api);
    if (routeFilter && !routeFilter.has(key)) continue;
    if (!isValidFixture(api)) continue;

    const fixture: ContractFixture = {
      route: key,
      host: api.host,
      path: api.path,
      status: api.status,
      request: api.requestBody ?? null,
      response: api.responseBody ?? null,
      requestHeaders: api.requestHeaders,
      capturedAt: api.timestamp,
    };
    const output = join(outputRoot, phaseFolder(api), fixtureFileName(key));
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
    emitted.push(`${phaseFolder(api)}/${fixtureFileName(key)}`);
  }

  if (routeFilter) {
    const emittedKeys = new Set(emitted.map((file) => file.split('/').at(-1)?.replace(/__/, '/')));
    const missing = [...routeFilter].filter((route) => !apis.some((api) => routeKey(api) === route));
    if (missing.length) {
      console.warn(`[fixtures] missing captured routes: ${missing.join(', ')}`);
    }
    void emittedKeys;
  }

  console.log(`[fixtures] ${emitted.length} fixtures -> apps/ladipage-backend/test/contract/fixtures`);
}

main().catch((err) => {
  console.error('[fixtures] failed:', err);
  process.exit(1);
});
