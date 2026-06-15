/**
 * Phase 7.4 — Post-migration / pre-cutover validation on PostgreSQL.
 * Usage: node scripts/migration/validate-cutover.js [--json]
 */
require('dotenv').config()
const { createPgClient, CORE_TABLES } = require('./lib/pg-client')

const asJson = process.argv.includes('--json')
const checks = []

function record(name, pass, detail = '') {
  checks.push({ name, pass, detail })
  if (!asJson) {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function main() {
  const client = createPgClient()
  await client.connect()

  if (!asJson) console.log('=== Phase 7.4 — Cutover Validation ===\n')

  for (const table of CORE_TABLES) {
    const { rows } = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists
    `, [table])
    record(`table exists: ${table}`, rows[0].exists)
  }

  const orphanRoles = await client.query(`
    SELECT COUNT(*)::int AS n FROM sys_user_roles ur
    WHERE NOT EXISTS (SELECT 1 FROM sys_user u WHERE u.id = ur.user_id)
       OR NOT EXISTS (SELECT 1 FROM sys_role r WHERE r.id = ur.role_id)
  `)
  record('FK sys_user_roles', orphanRoles.rows[0].n === 0, orphanRoles.rows[0].n ? `${orphanRoles.rows[0].n} orphans` : 'OK')

  const orphanMenus = await client.query(`
    SELECT COUNT(*)::int AS n FROM sys_role_menus rm
    WHERE NOT EXISTS (SELECT 1 FROM sys_role r WHERE r.id = rm.role_id)
       OR NOT EXISTS (SELECT 1 FROM sys_menu m WHERE m.id = rm.menu_id)
  `)
  record('FK sys_role_menus', orphanMenus.rows[0].n === 0, orphanMenus.rows[0].n ? `${orphanMenus.rows[0].n} orphans` : 'OK')

  const dupUser = await client.query(`
    SELECT username, COUNT(*)::int AS n FROM sys_user GROUP BY username HAVING COUNT(*) > 1
  `)
  record('unique sys_user.username', dupUser.rows.length === 0, dupUser.rows.length ? JSON.stringify(dupUser.rows) : 'OK')

  const dupSupabase = await client.query(`
    SELECT supabase_user_id, COUNT(*)::int AS n
    FROM sys_user WHERE supabase_user_id IS NOT NULL
    GROUP BY supabase_user_id HAVING COUNT(*) > 1
  `)
  record('unique supabase_user_id', dupSupabase.rows.length === 0, dupSupabase.rows.length ? JSON.stringify(dupSupabase.rows) : 'OK')

  const billingOrphans = await client.query(`
    SELECT COUNT(*)::int AS n FROM sys_subscription s
    WHERE s."organizationId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM sys_organizations o WHERE o.id = s."organizationId")
  `)
  record('FK sys_subscription → org', billingOrphans.rows[0].n === 0, billingOrphans.rows[0].n ? `${billingOrphans.rows[0].n} orphans` : 'OK')

  const tokenOrphans = await client.query(`
    SELECT COUNT(*)::int AS n FROM user_access_tokens t
    WHERE NOT EXISTS (SELECT 1 FROM sys_user u WHERE u.id = t.user_id)
  `)
  record('FK user_access_tokens', tokenOrphans.rows[0].n === 0, tokenOrphans.rows[0].n ? `${tokenOrphans.rows[0].n} orphans` : 'OK')

  const seqTables = ['sys_user', 'sys_role', 'sys_menu', 'sys_dept']
  for (const table of seqTables) {
    const max = await client.query(`SELECT COALESCE(MAX(id), 0)::bigint AS max_id FROM "${table}"`)
    const seq = await client.query(`SELECT pg_get_serial_sequence($1, 'id') AS seq`, [table])
    if (!seq.rows[0].seq) {
      record(`sequence ${table}`, true, 'no serial (skip)')
      continue
    }
    const seqName = seq.rows[0].seq
    const next = await client.query(`SELECT last_value::bigint AS last_value FROM ${seqName}`)
    const ok = Number(next.rows[0].last_value) >= Number(max.rows[0].max_id)
    record(`sequence ${table}`, ok, `max=${max.rows[0].max_id} last_value=${next.rows[0].last_value}`)
  }

  const linkage = await client.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(supabase_user_id)::int AS linked
    FROM sys_user WHERE status = 1
  `)
  const { total, linked } = linkage.rows[0]
  const pct = total ? Math.round((linked / total) * 100) : 100
  record('active users linked', pct >= 95 || total <= 3, `${linked}/${total} (${pct}%)`)

  const migrations = await client.query('SELECT COUNT(*)::int AS n FROM typeorm_migrations')
  record('typeorm_migrations', migrations.rows[0].n >= 2, `${migrations.rows[0].n} applied`)

  await client.end()

  const failed = checks.filter(c => !c.pass).length
  const summary = { checks, passed: checks.length - failed, failed, ok: failed === 0 }

  if (asJson) {
    console.log(JSON.stringify(summary, null, 2))
  }
  else {
    console.log(`\n=== Summary: ${summary.passed}/${checks.length} passed ===`)
  }

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})