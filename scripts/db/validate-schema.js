/**
 * Post-migration schema validation against PostgreSQL.
 * Usage: node scripts/db/validate-schema.js
 */
require('dotenv').config()
const { Client } = require('pg')

const EXPECTED_TABLES = [
  'sys_organizations', 'sys_dept', 'sys_role', 'sys_menu', 'sys_dict_type', 'sys_config',
  'sys_task', 'sys_user', 'sys_dict_item', 'sys_user_roles', 'sys_role_menus',
  'sys_login_log', 'sys_captcha_log', 'sys_task_log', 'todo', 'tool_storage',
  'user_access_tokens', 'user_refresh_tokens', 'sys_subscription', 'sys_credit_wallet',
  'sys_agent', 'tenants', 'tenant_users', 'typeorm_migrations',
]

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })

  await client.connect()

  const { rows } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)

  const existing = new Set(rows.map(r => r.table_name))
  const missing = EXPECTED_TABLES.filter(t => !existing.has(t))
  const extra = [...existing].filter(t => !EXPECTED_TABLES.includes(t) && !t.startsWith('pg_'))

  console.log('Tables found:', rows.length)
  console.log('Expected:', EXPECTED_TABLES.length)

  if (missing.length) {
    console.error('Missing tables:', missing)
    process.exitCode = 1
  }
  else {
    console.log('All expected tables present.')
  }

  if (extra.length) {
    console.warn('Extra tables (informational):', extra)
  }

  const userCols = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sys_user'
  `)
  const colNames = userCols.rows.map(r => r.column_name)
  if (!colNames.includes('supabase_user_id')) {
    console.error('sys_user.supabase_user_id column missing')
    process.exitCode = 1
  }
  else {
    console.log('sys_user.supabase_user_id: OK')
  }

  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})