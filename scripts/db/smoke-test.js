/**
 * Phase 6.6 smoke tests — DB, seed, Supabase Auth, optional HTTP API.
 * Usage: node scripts/db/smoke-test.js [--api]
 */
require('dotenv').config()
const { Client } = require('pg')
const { execSync } = require('node:child_process')

const runApi = process.argv.includes('--api')
const results = []

function record(name, pass, detail = '') {
  results.push({ name, pass, detail })
  const icon = pass ? 'PASS' : 'FAIL'
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function checkDbConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()
  const { rows } = await client.query('SELECT current_database() AS db, version() AS version')
  await client.end()
  record('DB connection', true, `${rows[0].db} (${rows[0].version.split(' ')[0]} ${rows[0].version.split(' ')[1]})`)
}

async function checkMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()
  const { rows } = await client.query('SELECT name FROM typeorm_migrations ORDER BY id')
  await client.end()

  const hasBaseline = rows.some(r => r.name === 'BaselinePostgres1741000000000')
  const hasSeed = rows.some(r => r.name === 'SeedInitialData1741000001000')
  record('Migration baseline', hasBaseline, rows.map(r => r.name).join(', ') || 'none')
  record('Migration seed', hasSeed)
}

async function checkSeed() {
  try {
    execSync('node scripts/db/validate-seed.js', { stdio: 'pipe' })
    record('Seed data', true)
  }
  catch (err) {
    record('Seed data', false, err.stderr?.toString().trim().split('\n').pop() || err.message)
  }
}

async function checkSupabaseAuth() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.SUPABASE_KEY

  if (!url || !key) {
    record('Supabase Auth config', false, 'SUPABASE_URL or public key missing')
    return
  }

  try {
    const { createClient } = require('@supabase/supabase-js')
    const client = createClient(url, key)
    const { data, error } = await client.auth.getSession()
    if (error) {
      record('Supabase Auth client', false, error.message)
      return
    }
    record('Supabase Auth client', true, data.session ? 'active session' : 'no session (expected)')
  }
  catch (err) {
    record('Supabase Auth client', false, err.message)
  }
}

async function checkSupabaseUserLinkage() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()

  const col = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'sys_user' AND column_name = 'supabase_user_id'
  `)
  record('supabase_user_id column', col.rows.length === 1)

  const counts = await client.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(supabase_user_id)::int AS linked
    FROM sys_user
  `)
  await client.end()
  const { total, linked: linkedCount } = counts.rows[0]
  record('Auth linkage schema', true, `${linkedCount}/${total} users linked (link on first exchange)`)
}

async function checkApiHealth() {
  const port = process.env.NEST_ADMIN_PORT || process.env.PORT || 7001
  const base = `http://127.0.0.1:${port}`

  try {
    const docs = await fetch(`${base}/docs/json`, { signal: AbortSignal.timeout(5000) })
    record('API GET /docs/json', docs.ok, `HTTP ${docs.status}`)

    const health = await fetch(`${base}/api/health/database`, { signal: AbortSignal.timeout(5000) })
    record('API GET /api/health/database', health.status === 401, `HTTP ${health.status} (401 without JWT expected)`)
  }
  catch (err) {
    record('API server', false, `not running on :${port} (${err.message})`)
  }
}

function checkStagingEnv() {
  const checks = [
    ['DB_TYPE=postgres', process.env.DB_TYPE === 'postgres'],
    ['DB_SSL=true', process.env.DB_SSL === 'true'],
    ['DATABASE_URL set', !!process.env.DATABASE_URL],
    ['SUPABASE_URL set', !!process.env.SUPABASE_URL],
    ['USE_SUPABASE_AUTH=true', process.env.USE_SUPABASE_AUTH === 'true'],
  ]

  for (const [label, pass] of checks) {
    record(`Env: ${label}`, pass)
  }
}

async function main() {
  console.log('=== Phase 6.6 Smoke Tests ===\n')

  checkStagingEnv()
  await checkDbConnection()
  await checkMigrations()
  await checkSeed()
  await checkSupabaseAuth()
  await checkSupabaseUserLinkage()

  if (runApi) {
    await checkApiHealth()
  }
  else {
    console.log('SKIP API health — pass --api when nest-admin is running')
  }

  console.log('\n=== Summary ===')
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  console.log(`${passed} passed, ${failed} failed, ${results.length} total`)

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})