#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildMergedTables, type FieldSchema } from './exporters/schema-exporter.js';
import type { SchemaDraft } from './exporters/schema-exporter.js';

function toTypeOrmColumn(field: FieldSchema): { name: string; type: string; nullable: boolean } {
  const snake = field.name.replace(/\./g, '_');
  const map: Record<string, string> = {
    string: 'varchar',
    integer: 'int',
    number: 'decimal',
    boolean: 'boolean',
    datetime: 'timestamptz',
    objectId: 'varchar',
    array: 'jsonb',
    object: 'jsonb',
    null: 'varchar',
    unknown: 'varchar',
  };
  return {
    name: snake,
    type: map[field.type] ?? 'varchar',
    nullable: field.nullable,
  };
}

async function main(): Promise<void> {
  const mergedDir = resolve('output/merged');
  const raw = await readFile(join(mergedDir, 'schema-draft.json'), 'utf8');
  const draft = JSON.parse(raw) as SchemaDraft;
  const tables = buildMergedTables(draft);

  const hints = tables.map((t) => ({
    table: t.table,
    entityName: t.table
      .split('_')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('') + 'Entity',
    sourceRoutes: t.sourceRoutes,
    columns: t.fields.map(toTypeOrmColumn),
    fieldCount: t.fields.length,
  }));

  await mkdir(mergedDir, { recursive: true });
  await writeFile(join(mergedDir, 'schema-tables-merged.json'), JSON.stringify(tables, null, 2), 'utf8');
  await writeFile(join(mergedDir, 'typeorm-hints.json'), JSON.stringify(hints, null, 2), 'utf8');

  console.log(`[export] ${tables.length} merged tables → schema-tables-merged.json`);
  console.log(`[export] TypeORM hints → typeorm-hints.json`);
  for (const h of hints) {
    console.log(`  ${h.table}: ${h.fieldCount} columns (${h.sourceRoutes.length} routes)`);
  }
}

main().catch((err) => {
  console.error('[export] failed:', err);
  process.exit(1);
});