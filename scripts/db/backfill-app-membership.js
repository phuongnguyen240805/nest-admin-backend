#!/usr/bin/env node
/**
 * Verify / repair sys_user_app_membership after app-scoped migration.
 * Usage: node scripts/db/backfill-app-membership.js
 */
require('dotenv').config()

const { Client } = require('pg')

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  const client = new Client({
    connectionString,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  })

  await client.connect()

  const apps = await client.query(`SELECT code, name, status FROM sys_app ORDER BY code`)
  console.log('sys_app:', apps.rows)

  const tenantAppCode = await client.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE "appCode" = 'ladipage')::int AS ladipage
    FROM tenants
  `)
  console.log('tenants.appCode:', tenantAppCode.rows[0])

  for (const appCode of ['ladipage', 'nest-admin']) {
    const inserted = await client.query(
      `
      INSERT INTO sys_user_app_membership ("userId", "appCode", "organizationId", "tenantId", "role", "status")
      SELECT u.id, $1, u."organizationId", t.id, 'owner', 1
      FROM sys_user u
      INNER JOIN tenants t ON t."organizationId" = u."organizationId"
      WHERE u."organizationId" IS NOT NULL
      ON CONFLICT ("userId", "appCode") DO NOTHING
      RETURNING id
      `,
      [appCode],
    )
    console.log(`membership backfill ${appCode}: inserted ${inserted.rowCount}`)
  }

  const usersWithoutOrg = await client.query(`
    SELECT COUNT(*)::int AS count
    FROM sys_user
    WHERE "organizationId" IS NULL
  `)
  console.log('users without organization:', usersWithoutOrg.rows[0].count)

  const missingLadipage = await client.query(`
    SELECT COUNT(*)::int AS count
    FROM sys_user u
    WHERE u."organizationId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM sys_user_app_membership m
        WHERE m."userId" = u.id AND m."appCode" = 'ladipage'
      )
  `)
  console.log('users missing ladipage membership:', missingLadipage.rows[0].count)

  const summary = await client.query(`
    SELECT m."appCode", COUNT(*)::int AS memberships
    FROM sys_user_app_membership m
    GROUP BY m."appCode"
    ORDER BY m."appCode"
  `)
  console.log('membership summary:', summary.rows)

  await client.end()

  if (missingLadipage.rows[0].count > 0) {
    process.exit(2)
  }

  console.log('OK — app membership backfill verified')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})