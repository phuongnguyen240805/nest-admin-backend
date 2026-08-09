#!/usr/bin/env node

require('dotenv').config()
require('../db/resolve-migration-env').resolveMigrationEnv()

const { Client } = require('pg')

const PERMISSIONS = [
  'ads:read',
  'ads:connection:manage',
  'ads:sync',
  'ads:publish',
  'ads:action',
]

function parseRoleIds() {
  const raw = process.env.ADS_PILOT_ROLE_IDS ?? process.argv[2] ?? ''
  const ids = raw.split(',').map((value) => Number(value.trim())).filter(Number.isInteger)
  if (!ids.length) throw new Error('Set ADS_PILOT_ROLE_IDS or pass comma-separated role IDs')
  return [...new Set(ids)]
}

async function main() {
  const roleIds = parseRoleIds()
  const client = new Client(
    process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_DATABASE,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
        },
  )
  await client.connect()
  try {
    await client.query('BEGIN')
    const roles = await client.query(
      'SELECT id, name, value FROM sys_role WHERE id = ANY($1::int[]) AND status = 1',
      [roleIds],
    )
    if (roles.rowCount !== roleIds.length) throw new Error('One or more pilot roles do not exist or are disabled')
    const result = await client.query(
      `INSERT INTO sys_role_menus (role_id, menu_id)
       SELECT role.id, menu.id
       FROM sys_role role
       CROSS JOIN sys_menu menu
       WHERE role.id = ANY($1::int[]) AND menu.permission = ANY($2::varchar[])
       ON CONFLICT (role_id, menu_id) DO NOTHING`,
      [roleIds, PERMISSIONS],
    )
    await client.query('COMMIT')
    console.log(`Ads pilot permissions ready for role IDs ${roleIds.join(', ')} (${result.rowCount} inserted)`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(`Ads pilot permission assignment failed: ${error.message}`)
  process.exit(1)
})
