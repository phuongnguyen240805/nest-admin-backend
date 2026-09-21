#!/usr/bin/env node
import { loadMonaConfig } from './config.js';
import { runMonaCrawl } from './crawler.js';

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  const config = await loadMonaConfig(process.argv.slice(2));
  console.log('[mona] CDP blog crawler v4-strapi');
  console.log(`  start:              ${config.startUrl}`);
  console.log(`  output:             ${config.outputDir}`);
  console.log(`  headless:           ${config.headless}`);
  console.log(`  article workers:    ${config.concurrency}`);
  console.log(`  archive workers:    ${config.archiveConcurrency}`);
  console.log(`  target articles:    ${config.maxArticles || 'all'}`);
  console.log(`  max attempts:       ${config.maxAttempts || 'all'}`);
  console.log(`  resume:             ${config.resume}`);
  console.log(`  network:            ${config.captureNetwork}`);
  console.log(`  all network meta:   ${config.captureAllNetworkMetadata}`);
  console.log(`  save html:          ${config.saveHtml}`);
  console.log(`  candidate mode:     ${config.candidateMode}`);

  const summary = await runMonaCrawl(config);
  console.log('\n[mona] finished');
  console.log(`  candidates: ${summary.uniqueCandidates}`);
  console.log(`  attempted:  ${summary.attempted}`);
  console.log(`  articles:   ${summary.articles}`);
  console.log(`  skipped:    ${summary.skippedNonArticles}`);
  console.log(`  errors:     ${summary.errors}`);
  console.log(`  duration:   ${(summary.durationMs / 1000).toFixed(1)}s`);
}

function printHelp(): void {
  console.log(`
CDP crawler dedicated to https://mona.media/blog/

Usage:
  npm run crawl:mona
  npm run crawl:mona:headed
  npm run crawl:mona:test
  npx tsx src/index.ts --config config.mona.json [options]

Options:
  --headed                 show Chromium UI
  --headless               force headless mode
  --limit N                stop after N successful articles (0 = all)
  --max-attempts N         safety cap for candidate attempts (0 = all)
  --concurrency N          article CDP workers, 1..8
  --archive-concurrency N  archive discovery workers, 1..6
  --archive-pages N        limit /blog/page/N discovery (0 = all)
  --delay MS               delay between URLs per article worker
  --output DIR             output directory
  --no-resume              remove existing output and start clean
  --no-sitemap             disable sitemap discovery
  --no-archive             disable /blog pagination discovery
  --strict-blog            require archive + post-sitemap intersection (default)
  --union-candidates       crawl union of archive/sitemap candidates
  --no-network             disable CDP network capture
  --api-network-only       keep only Document/XHR/Fetch metadata
  --all-network-metadata   keep metadata for every resource type
  --no-html                do not save rendered HTML
  --load-media             allow image/font/media bytes to load
`);
}

main().catch((err) => {
  console.error('[mona] failed:', err);
  process.exitCode = 1;
});
