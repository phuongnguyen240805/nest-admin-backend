/**
 * Validate PostgreSQL seed data after migration.
 * Usage: node scripts/db/validate-seed.js
 */
require('dotenv').config()
const { Client } = require('pg')

const EXPECTED = {
  sys_user: { min: 1, label: 'admin user' },
  sys_role: { min: 2, label: 'roles' },
  sys_menu: { min: 10, label: 'menus' },
  sys_role_menus: { min: 10, label: 'role-menu links' },
  sys_user_roles: { min: 1, label: 'user-role links' },
  sys_config: { min: 2, label: 'config entries' },
  sys_dept: { min: 1, label: 'departments' },
  sys_dict_type: { min: 1, label: 'dict types' },
  sys_dict_item: { min: 1, label: 'dict items' },
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()

  let failed = false

  for (const [table, { min, label }] of Object.entries(EXPECTED)) {
    const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM "${table}"`)
    const count = rows[0].count
    if (count < min) {
      console.error(`FAIL ${table}: ${count} rows (expected >= ${min} ${label})`)
      failed = true
    }
    else {
      console.log(`OK   ${table}: ${count} rows`)
    }
  }

  const admin = await client.query(`
    SELECT u.id, u.username, u."isSuperAdmin", r.name AS role_name
    FROM sys_user u
    LEFT JOIN sys_user_roles ur ON ur.user_id = u.id
    LEFT JOIN sys_role r ON r.id = ur.role_id
    WHERE u.username = 'admin'
    LIMIT 1
  `)

  if (!admin.rows.length) {
    console.error('FAIL admin user not found')
    failed = true
  }
  else {
    const row = admin.rows[0]
    console.log(`OK   admin: id=${row.id} isSuperAdmin=${row.isSuperAdmin} role=${row.role_name}`)
    if (!row.isSuperAdmin) {
      console.error('FAIL admin user should have isSuperAdmin=true')
      failed = true
    }
  }

  await client.end()
  if (failed) process.exit(1)
  console.log('Seed validation passed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})