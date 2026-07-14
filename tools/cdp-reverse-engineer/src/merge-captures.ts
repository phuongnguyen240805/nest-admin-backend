#!/usr/bin/env node
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildMergedTables, buildSchemaDraft, type SchemaDraft } from './exporters/schema-exporter.js';
import type { LadipageEndpoint } from './exporters/ladipage-flow.js';

async function latestDir(parent: string): Promise<string | null> {
  try {
    const entries = await readdir(parent, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    return dirs.length ? join(parent, dirs[dirs.length - 1]!) : null;
  } catch {
    return null;
  }
}

async function loadPostApis(dir: string): Promise<LadipageEndpoint[]> {
  try {
    const raw = await readFile(join(dir, 'ladipage-post-apis.json'), 'utf8');
    return JSON.parse(raw) as LadipageEndpoint[];
  } catch {
    return [];
  }
}

async function loadSchema(dir: string): Promise<SchemaDraft | null> {
  try {
    const raw = await readFile(join(dir, 'schema-draft.json'), 'utf8');
    return JSON.parse(raw) as SchemaDraft;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const root = resolve(process.cwd(), 'output');
  const phases: Array<{ name: string; path: string; fixed?: boolean }> = [
    { name: 'phase1-read', path: join(root, 'phase1-landing-read') },
    { name: 'phase1-editor', path: join(root, 'phase1-landing-editor') },
    { name: 'phase1-mutations', path: join(root, 'phase1-landing-mutations') },
    { name: 'phase1-landing-create', path: join(root, 'phase1-landing-create') },
    { name: 'settings-api', path: join(root, 'settings-api') },
    { name: 'settings-api-mutations', path: join(root, 'settings-api-mutations') },
    { name: 'phase2-read', path: join(root, 'phase2-banhang-read') },
    { name: 'phase2-detail', path: join(root, 'phase2-banhang-detail') },
    { name: 'phase2-mutations', path: join(root, 'phase2-banhang-mutations') },
    { name: 'phase3-read', path: join(root, 'phase3-khachhang-read') },
    { name: 'phase3-detail', path: join(root, 'phase3-khachhang-detail') },
    { name: 'phase3-mutations', path: join(root, 'phase3-khachhang-mutations') },
    { name: 'phase4-read', path: join(root, 'phase4-baocao-read') },
    { name: 'phase4-page', path: join(root, 'phase4-baocao-page') },
    { name: 'api-probe', path: join(root, 'api-probe') },
    { name: 'api-probe-p34', path: join(root, 'api-probe-phase34') },
    { name: 'phaseA-read', path: join(root, 'phaseA-kho-ung-dung-read') },
    { name: 'phaseA-mutations', path: join(root, 'phaseA-kho-ung-dung-mutations') },
    { name: 'phaseB-read', path: join(root, 'phaseB-ladiwork-read') },
    { name: 'phaseB-board', path: join(root, 'phaseB-ladiwork-board') },
    { name: 'phaseB-detail', path: join(root, 'phaseB-ladiwork-detail') },
    { name: 'phaseB-mutations', path: join(root, 'phaseB-ladiwork-mutations') },
    { name: 'phaseC-read', path: join(root, 'phaseC-automation-read') },
    { name: 'phaseC-editor', path: join(root, 'phaseC-automation-flow-editor') },
    { name: 'phaseC-mutations', path: join(root, 'phaseC-automation-mutations') },
    { name: 'api-probe-bc', path: join(root, 'api-probe-phaseBC') },
    { name: 'legacy-p1', path: join(root, 'ladipage-appv6-full/2026-06-22T15-03-02-972Z'), fixed: true },
    { name: 'legacy-p2', path: join(root, 'banhang-appv6-full/2026-06-23T03-18-13-221Z'), fixed: true },
  ];

  const allPosts: LadipageEndpoint[] = [];
  const drafts: SchemaDraft[] = [];
  const manifest: Array<{ phase: string; dir: string; routes: number }> = [];

  for (const phase of phases) {
    const dir = phase.fixed ? phase.path : await latestDir(phase.path);
    if (!dir) {
      console.warn(`[merge] Skip ${phase.name} — no output`);
      continue;
    }
    const posts = await loadPostApis(dir);
    allPosts.push(...posts);
    const existing = await loadSchema(dir);
    if (existing) drafts.push(existing);
    manifest.push({ phase: phase.name, dir, routes: posts.length });
    console.log(`[merge] ${phase.name}: ${posts.length} POST samples ← ${dir}`);
  }

  const score = (ep: LadipageEndpoint): number => {
    let s = ep.status === 200 ? 100 : 0;
    const body = ep.responseBody as { data?: unknown; code?: number } | undefined;
    if (body?.code === 200) s += 50;
    if (body?.data && typeof body.data === 'object') {
      const d = body.data as Record<string, unknown>;
      for (const v of Object.values(d)) {
        if (Array.isArray(v) && v.length > 0) s += 30;
      }
    }
    return s;
  };

  const unique = new Map<string, LadipageEndpoint>();
  for (const ep of allPosts) {
    const key = `${ep.host}${ep.path}`;
    const prev = unique.get(key);
    if (!prev || score(ep) > score(prev)) unique.set(key, ep);
  }

  const mergedSchema = buildSchemaDraft([...unique.values()]);
  if (drafts.length) {
    mergedSchema.gaps = [
      ...mergedSchema.gaps,
      ...drafts.flatMap((d) => d.gaps.map((g) => `[${d.generatedAt}] ${g}`)),
    ];
  }

  const outDir = join(root, 'merged');
  await mkdir(outDir, { recursive: true });

  const routes = [...unique.values()].sort((a, b) =>
    `${a.host}${a.path}`.localeCompare(`${b.host}${b.path}`),
  );
  const uniqueRouteList = [...new Set(routes.map((r) => `POST ${r.host}${r.path}`))].sort();

  await writeFile(join(outDir, 'ladipage-post-apis.json'), JSON.stringify(routes, null, 2), 'utf8');
  await writeFile(join(outDir, 'unique-routes.json'), JSON.stringify(uniqueRouteList, null, 2), 'utf8');
  await writeFile(join(outDir, 'schema-draft.json'), JSON.stringify(mergedSchema, null, 2), 'utf8');
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify({ phases: manifest, routeCount: uniqueRouteList.length }, null, 2), 'utf8');

  const tables = mergedSchema.entities
    .filter((e) => e.itemFields.length > 0 && e.suggestedTable)
    .map((e) => ({
      table: e.suggestedTable,
      sourceRoute: e.route,
      fields: e.itemFields,
      kind: e.kind,
    }));
  const mergedTables = buildMergedTables(mergedSchema);
  await writeFile(join(outDir, 'schema-tables.json'), JSON.stringify(tables, null, 2), 'utf8');
  await writeFile(join(outDir, 'schema-tables-merged.json'), JSON.stringify(mergedTables, null, 2), 'utf8');

  console.log('\n[merge] Done');
  console.log(`  tables:    ${tables.length} with itemFields (${mergedTables.length} merged)`);
  console.log(`  routes:    ${uniqueRouteList.length}`);
  console.log(`  read:      ${mergedSchema.readRoutes}`);
  console.log(`  mutation:  ${mergedSchema.mutationRoutes}`);
  console.log(`  gaps:      ${mergedSchema.gaps.length}`);
  console.log(`  output →   ${outDir}`);
}

main().catch((err) => {
  console.error('[merge] failed:', err);
  process.exit(1);
});
