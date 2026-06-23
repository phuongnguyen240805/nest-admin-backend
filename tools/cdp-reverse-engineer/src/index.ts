#!/usr/bin/env node
import { loadConfig } from './config.js';
import { runCapture } from './collector.js';
import { buildLadipageFlow, isLadipageApi, isLadipageBackendApi } from './exporters/ladipage-flow.js';

async function main(): Promise<void> {
  const config = await loadConfig(process.argv.slice(2));

  console.log('[cdp-reverse-engineer] starting capture');
  console.log(`  url:      ${config.url}`);
  console.log(`  duration: ${config.durationMs}ms`);
  console.log(`  headless: ${config.headless}`);
  console.log(`  output:   ${config.outputDir}`);
  if (config.storageStatePath) console.log(`  session:  ${config.storageStatePath}`);
  if (config.userDataDir) console.log(`  profile:  ${config.userDataDir}`);
  if (config.pauseForLoginMs) console.log(`  login wait: ${config.pauseForLoginMs}ms`);

  const report = await runCapture(config);
  const flow = buildLadipageFlow(report.apis, report.websockets, {
    url: report.meta.url,
    finalUrl: report.meta.finalUrl,
    pageTitle: report.meta.pageTitle,
  });

  console.log('\n[cdp-reverse-engineer] capture complete');
  console.log(`  finalUrl:    ${report.meta.finalUrl}`);
  console.log(`  pageTitle:   ${report.meta.pageTitle}`);
  console.log(`  APIs total:  ${report.summary.apiCount}`);
  console.log(`  Ladipage:    ${report.apis.filter(isLadipageApi).length} (backend POST: ${report.apis.filter(isLadipageBackendApi).length})`);
  console.log(`  WebSockets:  ${report.summary.websocketCount} (${report.summary.websocketFrameCount} frames)`);
  console.log(`  Services:    ${report.summary.services.join(', ') || '(none)'}`);
  console.log(`  NestJS hints: ${report.nestjsHints.length}`);

  if (flow.uniqueRoutes.length > 0) {
    console.log(`\n  Ladipage POST routes: ${flow.uniqueRoutes.length} (read: ${flow.readRoutes.length}, mutation: ${flow.mutationRoutes.length})`);
    for (const route of flow.uniqueRoutes) {
      console.log(`    ${route}`);
    }
    if (flow.mutationRoutes.length > 0) {
      console.log('\n  Mutation routes:');
      for (const route of flow.mutationRoutes) {
        console.log(`    ${route}`);
      }
    }
  }

  if (flow.postEndpoints.length > 0) {
    console.log('\n  Sample POST bodies:');
    for (const ep of flow.postEndpoints.slice(0, 6)) {
      const body = ep.requestBody ? JSON.stringify(ep.requestBody).slice(0, 120) : '(none)';
      console.log(`    POST ${ep.path} [${ep.status ?? '?'}] → ${body}`);
    }
  }

  if (report.meta.finalUrl.includes('/auth/login')) {
    console.log('\n  ⚠ Chưa vào app — chạy lần đầu: npm run capture:ladipage:login');
    console.log('    Sau đó dùng lại session: npm run capture:ladipage:session');
  } else if (flow.postEndpoints.some((e) => e.path.includes('ladi-page'))) {
    console.log('\n  ✓ Đã bắt API ladi-page/* — xem ladipage-post-apis.json');
  }

  if (flow.rebuildNotes.length > 0) {
    console.log('\n  Notes:');
    for (const note of flow.rebuildNotes) {
      console.log(`    • ${note}`);
    }
  }

  if (report.websockets.length > 0) {
    console.log('\n  WebSockets:');
    for (const ws of report.websockets.slice(0, 5)) {
      console.log(`    ${ws.url} (${ws.frames.length} frames)${ws.service ? ` [${ws.service}]` : ''}`);
    }
  }
}

main().catch((err) => {
  console.error('[cdp-reverse-engineer] failed:', err);
  process.exit(1);
});