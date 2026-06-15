/**
 * Convert MySQL INSERT seed data from nest_admin.sql to PostgreSQL syntax.
 * Usage: node scripts/db/convert-mysql-seed-to-pg.js
 */
const fs = require('node:fs')
const path = require('node:path')

const SOURCE = path.join(__dirname, '../../docker/deploy/sql/nest_admin.sql')
const OUTPUT = path.join(__dirname, '../../docker/deploy/sql/nest_admin.pg.sql')

const SEED_TABLES = new Set([
  'sys_config',
  'sys_dept',
  'sys_dict_type',
  'sys_dict_item',
  'sys_menu',
  'sys_role',
  'sys_role_menus',
  'sys_user',
  'sys_user_roles',
])

function quoteIdent(name) {
  return `"${name}"`
}

function splitValues(valuesStr) {
  const values = []
  let current = ''
  let inString = false
  let i = 0

  while (i < valuesStr.length) {
    const ch = valuesStr[i]

    if (inString) {
      current += ch
      if (ch === "'" && valuesStr[i + 1] === "'") {
        current += valuesStr[i + 1]
        i += 2
        continue
      }
      if (ch === "'") inString = false
      i++
      continue
    }

    if (ch === "'") {
      inString = true
      current += ch
      i++
      continue
    }

    if (ch === ',') {
      values.push(current.trim())
      current = ''
      i++
      continue
    }

    current += ch
    i++
  }

  if (current.trim()) values.push(current.trim())
  return values
}

function parseInsert(line) {
  const match = line.match(/^INSERT INTO `(\w+)` \((.+)\) VALUES \((.+)\);$/)
  if (!match) return null

  const table = match[1]
  const columns = match[2].split('`, `').map(c => c.replace(/`/g, ''))
  const values = splitValues(match[3])

  return { table, columns, values }
}

function transformInsert(parsed) {
  let { table, columns, values } = parsed

  if (table === 'sys_dict_item') {
    const orderIdx = columns.indexOf('order')
    if (orderIdx !== -1) {
      columns = columns.filter(c => c !== 'order')
      values = values.filter((_, i) => i !== orderIdx)
    }
  }

  if (table === 'sys_menu') {
    const isExtIdx = columns.indexOf('is_ext')
    if (isExtIdx !== -1) {
      values[isExtIdx] = values[isExtIdx] === '1' ? 'true' : 'false'
    }
  }

  if (table === 'sys_role') {
    const defaultIdx = columns.indexOf('default')
    if (defaultIdx !== -1) {
      if (values[defaultIdx] === '1') values[defaultIdx] = 'true'
      if (values[defaultIdx] === '0') values[defaultIdx] = 'false'
    }
  }

  if (table === 'sys_user') {
    const usernameIdx = columns.indexOf('username')
    columns.splice(usernameIdx + 1, 0, 'isSuperAdmin')
    const isAdmin = values[0] === '1' ? 'true' : 'false'
    values.splice(usernameIdx + 1, 0, isAdmin)
  }

  const quotedCols = columns.map(quoteIdent).join(', ')
  return `INSERT INTO ${quoteIdent(table)} (${quotedCols}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;`
}

function main() {
  const source = fs.readFileSync(SOURCE, 'utf8')
  const lines = source.split('\n')
  const statements = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('INSERT INTO `')) continue

    const parsed = parseInsert(trimmed)
    if (!parsed || !SEED_TABLES.has(parsed.table)) continue

    statements.push(transformInsert(parsed))
  }

  const sequences = [
    'sys_config',
    'sys_dept',
    'sys_dict_type',
    'sys_dict_item',
    'sys_menu',
    'sys_role',
    'sys_user',
  ].map(table =>
    `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${quoteIdent(table)}), 1));`,
  )

  const INSERT_ORDER = [
    'sys_config',
    'sys_dept',
    'sys_dict_type',
    'sys_dict_item',
    'sys_role',
    'sys_menu',
    'sys_user',
    'sys_role_menus',
    'sys_user_roles',
  ]

  const byTable = Object.fromEntries(INSERT_ORDER.map(t => [t, []]))
  for (const stmt of statements) {
    const table = stmt.match(/^INSERT INTO "(\w+)"/)?.[1]
    if (table && byTable[table]) byTable[table].push(stmt)
  }

  const ordered = INSERT_ORDER.flatMap(t => byTable[t])

  const output = [
    '-- PostgreSQL seed data converted from docker/deploy/sql/nest_admin.sql',
    '-- Regenerate: node scripts/db/convert-mysql-seed-to-pg.js',
    '',
    ...ordered,
    '',
    '-- Reset sequences after explicit IDs',
    ...sequences,
    '',
  ].join('\n')

  fs.writeFileSync(OUTPUT, output)
  console.log(`Wrote ${ordered.length} INSERT statements to ${OUTPUT}`)
}

main()