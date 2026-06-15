/**
 * Phase 7 orchestrator — audit PG, validate cutover, optional backfill dry-run.
 * Usage: node scripts/migration/run-phase7.js
 */
require('dotenv').config()
const { execSync } = require('node:child_process')
const path = require('node:path')

const root = path.join(__dirname, '../..')
const run = (script, args = '') => execSync(`node "${path.join(__dirname, script)}" ${args}`, { cwd: root, stdio: 'inherit', shell: true })

console.log('########## Phase 7 — Data Migration Toolchain ##########\n')

run('audit-pg.js')
console.log('')
run('validate-cutover.js')
console.log('')

if (process.env.MYSQL_SOURCE_URL) {
  console.log('--- MySQL source audit ---')
  run('audit-mysql.js')
  console.log('')
}

console.log('--- Backfill dry-run ---')
run('backfill-supabase-users.js', '--dry-run')

console.log('\nDone. Apply backfill: node scripts/migration/backfill-supabase-users.js --apply')