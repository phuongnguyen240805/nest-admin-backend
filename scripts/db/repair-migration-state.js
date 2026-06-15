/**
 * Mark baseline migration as applied when schema already exists
 * but typeorm_migrations was not recorded (e.g. partial failed run).
 *
 * Usage: node scripts/db/repair-migration-state.js [--dry-run]
 */
require('dotenv').config()
const { Client } = require('pg')
const { execSync } = require('node:child_process')

const BASELINE = {
  timestamp: 1741000000000,
  name: 'BaselinePostgres1741000000000',
}

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()

  const { rows: existing } = await client.query(
    'SELECT id, timestamp, name FROM typeorm_migrations ORDER BY id',
  )

  if (existing.some(r => r.name === BASELINE.name)) {
    console.log(`Migration already recorded: ${BASELINE.name}`)
    await client.end()
    return
  }

  console.log('Validating schema before repair...')
  execSync('node scripts/db/validate-schema.js', { stdio: 'inherit' })

  if (dryRun) {
    console.log('[dry-run] Would insert:', BASELINE)
    await client.end()
    return
  }

  await client.query(
    'INSERT INTO typeorm_migrations (timestamp, name) VALUES ($1, $2)',
    [BASELINE.timestamp, BASELINE.name],
  )

  console.log(`Recorded migration: ${BASELINE.name}`)
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})