/**
 * Phase 7.1 — MySQL source audit (pre-cutover row counts).
 * Usage: MYSQL_SOURCE_URL=mysql://... node scripts/migration/audit-mysql.js
 */
require('dotenv').config()

const SOURCE_TABLES = [
  'sys_user', 'sys_role', 'sys_menu', 'sys_dept', 'sys_config',
  'sys_dict_type', 'sys_dict_item', 'sys_user_roles', 'sys_role_menus',
  'todo', 'tool_storage', 'user_access_tokens', 'user_refresh_tokens',
]

async function main() {
  const url = process.env.MYSQL_SOURCE_URL || process.env.MYSQL_DATABASE_URL
  if (!url?.startsWith('mysql')) {
    console.error('Set MYSQL_SOURCE_URL=mysql://user:pass@host:3306/db')
    process.exit(1)
  }

  const mysql = require('mysql2/promise')
  const conn = await mysql.createConnection(url)

  console.log('=== Phase 7.1 — MySQL Source Audit ===\n')

  for (const table of SOURCE_TABLES) {
    try {
      const [rows] = await conn.query(`SELECT COUNT(*) AS count FROM \`${table}\``)
      console.log(`  ${table.padEnd(24)} ${rows[0].count}`)
    }
    catch (err) {
      console.log(`  ${table.padEnd(24)} SKIP (${err.code || err.message})`)
    }
  }

  await conn.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})