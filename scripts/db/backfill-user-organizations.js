#!/usr/bin/env node
/**
 * Backfill organizationId + tenant for sys_user rows missing a workspace.
 * Run from monorepo root: node scripts/db/backfill-user-organizations.js
 *
 * Requires DATABASE_URL in environment (reads .env via dotenv if present).
 */
const { readFileSync, existsSync } = require('node:fs')
const { resolve } = require('node:path')
const { Client } = require('pg')

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function slugify(name) {
  const slug = String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
  return slug || 'workspace'
}

async function ensureUniqueHandle(client, base) {
  let handle = base
  let suffix = 0
  while (true) {
    const { rows } = await client.query('SELECT 1 FROM tenants WHERE handle = $1 LIMIT 1', [handle])
    if (rows.length === 0) return handle
    suffix += 1
    handle = `${base}-${suffix}`.slice(0, 100)
  }
}

async function main() {
  loadEnv()
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()

  const { rows: users } = await client.query(
    `SELECT id, username, nickname, email FROM sys_user WHERE "organizationId" IS NULL`,
  )

  console.log(`Found ${users.length} user(s) without organizationId`)

  for (const user of users) {
    const orgName = user.nickname || user.username || user.email?.split('@')[0] || `Workspace ${user.id}`

    await client.query('BEGIN')
    try {
      const orgInsert = await client.query(
        `INSERT INTO sys_organizations (id, name, description, "allowTrial", "isTrailing", shortlink, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, true, false, 'ASK', NOW(), NOW())
         RETURNING id, name`,
        [orgName, `Workspace for ${user.username}`],
      )
      const organizationId = orgInsert.rows[0].id

      await client.query(
        `INSERT INTO sys_subscription ("organizationId", "subscriptionTier", period, "totalChannels", "isLifetime", "createdAt", "updatedAt")
         VALUES ($1, 'free', 'monthly', 0, false, NOW(), NOW())
         ON CONFLICT ("organizationId") DO NOTHING`,
        [organizationId],
      )

      await client.query(`UPDATE sys_user SET "organizationId" = $1 WHERE id = $2`, [organizationId, user.id])

      const handle = await ensureUniqueHandle(client, slugify(orgName))
      const tenantExists = await client.query(
        `SELECT id FROM tenants WHERE "organizationId" = $1 LIMIT 1`,
        [organizationId],
      )

      if (tenantExists.rows.length === 0) {
        await client.query(
          `INSERT INTO tenants (handle, name, status, settings, "organizationId", created_at, updated_at)
           VALUES ($1, $2, 'active', NULL, $3, NOW(), NOW())`,
          [handle, orgName, organizationId],
        )
      }

      await client.query('COMMIT')
      console.log(`Provisioned workspace for user ${user.id} → org ${organizationId}`)
    } catch (error) {
      await client.query('ROLLBACK')
      console.error(`Failed for user ${user.id}:`, error.message)
    }
  }

  await client.end()
  console.log('Backfill complete. Users must re-login to refresh JWT tenant claims.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})