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
}

interface ContractFixture {
  route: string;
  host: string;
  path: string;
  status?: number;
  request: unknown;
  response: unknown;
  requestHeaders?: Record<string, unknown>;
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
  if (api.host === 'api.ladiflow.com') return 'phase3';
  if (routeKey(api).startsWith('report/')) return 'phase4';
  if (
    routeKey(api).startsWith('order/') ||
    routeKey(api).startsWith('product/') ||
    routeKey(api).startsWith('checkout') ||
    routeKey(api).startsWith('payment/') ||
    routeKey(api).startsWith('shipping/')
  ) {
    return 'phase2';
  }
  return 'phase1';
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

    const fixture: ContractFixture = {
      route: key,
      host: api.host,
      path: api.path,
      status: api.status,
      request: api.requestBody ?? null,
      response: api.responseBody ?? null,
      requestHeaders: api.requestHeaders,
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
