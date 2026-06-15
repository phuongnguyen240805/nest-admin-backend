/**
 * Phase 7.1 — PostgreSQL audit: row counts, sizes, user linkage stats.
 * Usage: node scripts/migration/audit-pg.js [--json]
 */
require('dotenv').config()
const { createPgClient, CORE_TABLES } = require('./lib/pg-client')

const asJson = process.argv.includes('--json')

async function main() {
  const client = createPgClient()
  await client.connect()

  const counts = []
  for (const table of CORE_TABLES) {
    const { rows } = await client.query(`SELECT COUNT(*)::bigint AS count FROM "${table}"`)
    counts.push({ table, rows: Number(rows[0].count) })
  }

  const users = await client.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(supabase_user_id)::int AS linked,
      COUNT(*) FILTER (WHERE email IS NOT NULL AND email <> '')::int AS with_email,
      COUNT(*) FILTER (WHERE supabase_user_id IS NULL AND email IS NOT NULL)::int AS pending_link
    FROM sys_user
  `)

  const migrations = await client.query(
    'SELECT name, timestamp FROM typeorm_migrations ORDER BY id',
  )

  const report = {
    database: 'postgresql',
    auditedAt: new Date().toISOString(),
    tableCounts: counts,
    totalRows: counts.reduce((s, t) => s + t.rows, 0),
    users: users.rows[0],
    migrations: migrations.rows,
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 2))
  }
  else {
    console.log('=== Phase 7.1 — PostgreSQL Audit ===\n')
    console.log('Table row counts:')
    for (const { table, rows } of counts) {
      console.log(`  ${table.padEnd(24)} ${rows}`)
    }
    console.log(`\nTotal rows (core tables): ${report.totalRows}`)
    console.log('\nUser linkage:')
    console.log(`  total: ${report.users.total}`)
    console.log(`  linked supabase_user_id: ${report.users.linked}`)
    console.log(`  with email: ${report.users.with_email}`)
    console.log(`  pending link: ${report.users.pending_link}`)
    console.log('\nMigrations:')
    for (const m of report.migrations) {
      console.log(`  - ${m.name}`)
    }
  }

  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})