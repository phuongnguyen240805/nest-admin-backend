import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyzeServices } from './analyzers/service-analyzer.js';
import { ensureLoggedIn, gotoPage, openBrowserSession, saveSession } from './browser-session.js';
import { NetworkCollector } from './cdp/network-collector.js';
import { collectState, readUserAgent } from './cdp/state-collector.js';
import { WebSocketCollector } from './cdp/websocket-collector.js';
import type { CaptureConfig, CaptureReport } from './types.js';
import { runAction } from './actions.js';
import { buildNestJsHints, buildOpenApiStub } from './exporters/nestjs-exporter.js';
import { buildLadipageFlow, isLadipageBackendApi } from './exporters/ladipage-flow.js';
import { buildSchemaDraft } from './exporters/schema-exporter.js';
import { nowIso } from './utils.js';

export async function runCapture(config: CaptureConfig): Promise<CaptureReport> {
  const startedAt = nowIso();
  const session = await openBrowserSession(config);
  const { context, page } = session;
  const cdp = await context.newCDPSession(page);

  const network = new NetworkCollector(config.servicePatterns ?? [], config.maxBodyBytes);
  const websocket = new WebSocketCollector(config.servicePatterns ?? [], config.maxBodyBytes);

  await network.attach(cdp);
  await websocket.attach(cdp);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  console.log('[cdp] CDP attached — bắt đầu ghi network');

  const progress = setInterval(() => {
    const backend = network.apis.filter(isLadipageBackendApi).length;
    console.log(`[cdp] ... ${network.apis.length} requests | ${backend} Ladipage POST | ${page.url()}`);
  }, 8000);

  try {
    const loggedIn = await ensureLoggedIn(page, config);
    if (!loggedIn && config.pauseForLoginMs) {
      console.warn('[cdp] Cảnh báo: chưa thoát trang login trong thời gian chờ.');
    }

    await gotoPage(page, config.url, config.url);

    const routeKeys = () =>
      new Set(
        network.apis
          .filter(isLadipageBackendApi)
          .map((a) => `${a.method} ${a.host}${a.path}`),
      );

    for (const [i, action] of (config.actions ?? []).entries()) {
      const before = routeKeys();
      if (action.type === 'navigate' && action.value) {
        await gotoPage(page, action.value, action.value);
      } else {
        await runAction(page, action, i);
      }
      const after = routeKeys();
      const added = [...after].filter((r) => !before.has(r));
      if (added.length > 0) {
        console.log(`[cdp] +${added.length} route sau action ${i + 1}${action.label ? ` [${action.label}]` : ''}: ${added.join(', ')}`);
      }
    }

    console.log(`[cdp] Capture thêm ${config.durationMs}ms...`);
    await page.waitForTimeout(config.durationMs);
  } finally {
    clearInterval(progress);
  }

  const state = await collectState(page, config.servicePatterns ?? []);
  const services = analyzeServices(
    config.servicePatterns ?? [],
    network.apis,
    websocket.entries,
    state,
  );
  const nestjsHints = buildNestJsHints(network.apis);

  const finalUrl = page.url();
  const pageTitle = await page.title().catch(() => '');
  const finishedAt = nowIso();

  if (config.saveStorageStatePath) {
    await saveSession(context, config.saveStorageStatePath, finalUrl);
  }

  const report: CaptureReport = {
    meta: {
      url: config.url,
      finalUrl,
      pageTitle,
      startedAt,
      finishedAt,
      durationMs: config.durationMs,
      userAgent: await readUserAgent(page),
    },
    summary: {
      apiCount: network.apis.length,
      websocketCount: websocket.entries.length,
      websocketFrameCount: websocket.entries.reduce((n, w) => n + w.frames.length, 0),
      services: services.filter((s) => s.apis.length || s.websockets.length || s.globals.length).map((s) => s.name),
    },
    apis: network.apis,
    websockets: websocket.entries,
    state,
    services,
    nestjsHints,
  };

  console.log('[cdp] Đang ghi file output...');
  await session.close();
  const outDir = await persistReport(config.outputDir, report);
  console.log(`[cdp] Output → ${outDir}`);
  return report;
}

async function persistReport(outputDir: string, report: CaptureReport): Promise<string> {
  const stamp = report.meta.startedAt.replace(/[:.]/g, '-');
  const dir = join(outputDir, stamp);
  await mkdir(dir, { recursive: true });

  await writeFile(join(dir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  await writeFile(join(dir, 'apis.json'), JSON.stringify(report.apis, null, 2), 'utf8');
  await writeFile(join(dir, 'websockets.json'), JSON.stringify(report.websockets, null, 2), 'utf8');
  await writeFile(join(dir, 'state.json'), JSON.stringify(report.state, null, 2), 'utf8');
  await writeFile(join(dir, 'services.json'), JSON.stringify(report.services, null, 2), 'utf8');
  await writeFile(join(dir, 'nestjs-hints.json'), JSON.stringify(report.nestjsHints, null, 2), 'utf8');
  await writeFile(
    join(dir, 'openapi-stub.json'),
    JSON.stringify(buildOpenApiStub(report.nestjsHints), null, 2),
    'utf8',
  );

  const ladipageFlow = buildLadipageFlow(report.apis, report.websockets, {
    url: report.meta.url,
    finalUrl: report.meta.finalUrl,
    pageTitle: report.meta.pageTitle,
  });
  await writeFile(join(dir, 'ladipage-flow.json'), JSON.stringify(ladipageFlow, null, 2), 'utf8');
  await writeFile(
    join(dir, 'ladipage-post-apis.json'),
    JSON.stringify(ladipageFlow.postEndpoints, null, 2),
    'utf8',
  );

  const schemaDraft = buildSchemaDraft(ladipageFlow.postEndpoints);
  await writeFile(join(dir, 'schema-draft.json'), JSON.stringify(schemaDraft, null, 2), 'utf8');
  if (ladipageFlow.mutationRoutes.length > 0) {
    await writeFile(
      join(dir, 'mutation-routes.json'),
      JSON.stringify(ladipageFlow.mutationRoutes, null, 2),
      'utf8',
    );
  }

  return dir;
}