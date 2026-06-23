#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface FieldSchema {
  name: string;
  type: string;
  nullable: boolean;
}

interface MergedTableSchema {
  table: string;
  sourceRoutes: string[];
  fields: FieldSchema[];
}

interface OutputFile {
  path: string;
  exports: string[];
}

const GENERATED_HEADER = `/* eslint-disable */\n// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.\n// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.\n`;

const TYPE_BY_FIELD_TYPE: Record<string, string> = {
  string: 'string',
  integer: 'number',
  number: 'number',
  boolean: 'boolean',
  datetime: 'string',
  objectId: 'string',
  array: 'unknown[]',
  object: 'LadipageJsonObject',
  null: 'unknown',
  unknown: 'unknown',
};

function pascalCase(input: string): string {
  return input
    .split(/[_\-.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function kebabCase(input: string): string {
  return input.replace(/^lp_/, '').replace(/_/g, '-');
}

function tableToFolder(table: string): string {
  if (
    [
      'lp_page',
      'lp_page_tag',
      'lp_domain',
      'lp_form_config',
      'lp_template',
      'lp_lead',
      'lp_staff',
      'lp_application',
    ].includes(table)
  ) {
    return 'landing';
  }
  if (
    table.startsWith('lp_order') ||
    table.startsWith('lp_product') ||
    [
      'lp_custom_field',
      'lp_checkout',
      'lp_checkout_config',
      'lp_page_checkout',
      'lp_payment',
      'lp_delivery_note',
      'lp_inventory',
      'lp_filter',
      'lp_customer',
      'lp_store',
    ].includes(table)
  ) {
    return 'ecom';
  }
  return 'misc';
}

function fieldType(field: FieldSchema): string {
  const base = TYPE_BY_FIELD_TYPE[field.type] ?? 'unknown';
  return field.nullable ? `${base} | null` : base;
}

function renderTable(table: MergedTableSchema): string {
  const name = pascalCase(table.table);
  const routes = table.sourceRoutes.map((route) => ` * - ${route}`).join('\n');
  const fields = table.fields
    .map((field) => `  '${field.name}'?: ${fieldType(field)};`)
    .join('\n');

  return `${GENERATED_HEADER}\nimport type { LadipageJsonObject } from '../common';\n\n/**\n * Source routes:\n${routes}\n */\nexport interface ${name} {\n${fields}\n}\n`;
}

function renderIndex(exports: string[]): string {
  return `${GENERATED_HEADER}\n${exports.map((item) => `export * from './${item}';`).join('\n')}\n`;
}

function renderCommon(): string {
  return `${GENERATED_HEADER}\nexport type LadipageJsonPrimitive = string | number | boolean | null;\nexport type LadipageJsonValue = LadipageJsonPrimitive | LadipageJsonObject | LadipageJsonValue[];\nexport interface LadipageJsonObject {\n  [key: string]: LadipageJsonValue;\n}\n\nexport interface LadipageRpcResponse<TData> {\n  data: TData;\n  message: string;\n  code: 200;\n}\n\nexport interface PagedSearch {\n  paged?: number;\n  limit?: number;\n  search?: string;\n  key_word?: string;\n  lang?: string;\n}\n\nexport interface SortBody {\n  sort?: string | Record<string, unknown>;\n  sort_by?: string;\n  sort_type?: 'asc' | 'desc' | 'ASC' | 'DESC' | string;\n}\n`;
}

async function writeGeneratedFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const toolRoot = resolve(scriptDir, '..');
  const workspaceRoot = resolve(toolRoot, '../..');
  const mergedDir = join(toolRoot, 'output/merged');
  const outputRoot = join(workspaceRoot, 'apps/ladipage-backend/libs/ladipage-types/src');
  const raw = await readFile(join(mergedDir, 'schema-tables-merged.json'), 'utf8');
  const tables = JSON.parse(raw) as MergedTableSchema[];

  await mkdir(outputRoot, { recursive: true });
  await writeGeneratedFile(join(outputRoot, 'common.ts'), renderCommon());

  const byFolder = new Map<string, OutputFile>();
  for (const table of tables) {
    const folder = tableToFolder(table.table);
    const fileName = `${kebabCase(table.table)}.types`;
    await writeGeneratedFile(join(outputRoot, folder, `${fileName}.ts`), renderTable(table));

    const entry = byFolder.get(folder) ?? { path: folder, exports: [] };
    entry.exports.push(fileName);
    byFolder.set(folder, entry);
  }

  const folderIndexes = [...byFolder.values()].sort((a, b) => a.path.localeCompare(b.path));
  for (const folder of folderIndexes) {
    await writeGeneratedFile(
      join(outputRoot, folder.path, 'index.ts'),
      renderIndex(folder.exports.sort()),
    );
  }

  await writeGeneratedFile(
    join(outputRoot, 'index.ts'),
    `${GENERATED_HEADER}\nexport * from './common';\n${folderIndexes
      .map((folder) => `export * from './${folder.path}';`)
      .join('\n')}\n`,
  );

  console.log(`[export] ${tables.length} tables -> apps/ladipage-backend/libs/ladipage-types/src`);
}

main().catch((err) => {
  console.error('[export] failed:', err);
  process.exit(1);
});
