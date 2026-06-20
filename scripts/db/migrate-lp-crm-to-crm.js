#!/usr/bin/env node
/**
 * Phase 6: Migrate legacy lp_* CRM data → crm_* v2 tables.
 *
 * Usage (from monorepo root):
 *   node scripts/db/migrate-lp-crm-to-crm.js              # run migration
 *   node scripts/db/migrate-lp-crm-to-crm.js --dry-run    # preview only
 *   node scripts/db/migrate-lp-crm-to-crm.js --validate   # count check only
 *   node scripts/db/migrate-lp-crm-to-crm.js --tenant=1   # single tenant
 *
 * Requires DATABASE_URL. Idempotent — skips rows already in crm_id_map.
 *
 * Rollback: set CRM_ENABLED=false (crm_id_map retained for re-run).
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function parseArgs() {
  const args = process.argv.slice(2)
  return {
    dryRun: args.includes('--dry-run'),
    validateOnly: args.includes('--validate'),
    tenantId: (() => {
      const t = args.find((a) => a.startsWith('--tenant='))
      return t ? Number.parseInt(t.split('=')[1], 10) : null
    })(),
  }
}

function parseName(fullName) {
  const trimmed = String(fullName || '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return { firstName: null, lastName: null, name: '' }
  const parts = trimmed.split(' ')
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null, name: trimmed }
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
    name: trimmed,
  }
}

function normalizeEmail(email) {
  if (!email) return null
  const v = String(email).trim().toLowerCase()
  return v || null
}

async function tableExists(client, table) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  )
  return rows.length > 0
}

async function getMappedLegacyIds(client, entityType, tenantId) {
  const params = [entityType]
  let sql = `SELECT legacy_id, crm_id FROM crm_id_map WHERE entity_type = $1`
  if (tenantId != null) {
    sql += ` AND "tenantId" = $2`
    params.push(tenantId)
  }
  const { rows } = await client.query(sql, params)
  return new Map(rows.map((r) => [r.legacy_id, r.crm_id]))
}

async function validateCounts(client, tenantId) {
  const tenantFilter = tenantId != null ? 'WHERE "tenantId" = $1' : ''
  const params = tenantId != null ? [tenantId] : []

  const queries = {
    lp_company: `SELECT "tenantId", COUNT(*)::int AS count FROM lp_company ${tenantFilter} GROUP BY "tenantId" ORDER BY "tenantId"`,
    lp_customer: `SELECT "tenantId", COUNT(*)::int AS count FROM lp_customer ${tenantFilter} GROUP BY "tenantId" ORDER BY "tenantId"`,
    map_company: `SELECT "tenantId", COUNT(*)::int AS count FROM crm_id_map WHERE entity_type = 'company' ${tenantId != null ? 'AND "tenantId" = $1' : ''} GROUP BY "tenantId" ORDER BY "tenantId"`,
    map_person: `SELECT "tenantId", COUNT(*)::int AS count FROM crm_id_map WHERE entity_type = 'person' ${tenantId != null ? 'AND "tenantId" = $1' : ''} GROUP BY "tenantId" ORDER BY "tenantId"`,
    crm_person: `SELECT "tenantId", COUNT(*)::int AS count FROM crm_person WHERE deleted_at IS NULL ${tenantFilter} GROUP BY "tenantId" ORDER BY "tenantId"`,
    crm_company: `SELECT "tenantId", COUNT(*)::int AS count FROM crm_company WHERE deleted_at IS NULL ${tenantFilter} GROUP BY "tenantId" ORDER BY "tenantId"`,
    orders_linked: `SELECT "tenantId", COUNT(*)::int AS count FROM lp_order WHERE person_id IS NOT NULL ${tenantFilter} GROUP BY "tenantId" ORDER BY "tenantId"`,
    orders_with_customer: `SELECT "tenantId", COUNT(*)::int AS count FROM lp_order WHERE "customerId" IS NOT NULL ${tenantFilter} GROUP BY "tenantId" ORDER BY "tenantId"`,
  }

  const results = {}
  for (const [key, sql] of Object.entries(queries)) {
    const { rows } = await client.query(sql, params)
    results[key] = rows
  }

  console.log('\n=== CRM migration validation ===\n')

  const tenantIds = new Set()
  for (const rows of Object.values(results)) {
    for (const row of rows) tenantIds.add(row.tenantId)
  }

  let allOk = true

  for (const tid of [...tenantIds].sort((a, b) => a - b)) {
    const lpCust = results.lp_customer.find((r) => r.tenantId === tid)?.count ?? 0
    const mapPerson = results.map_person.find((r) => r.tenantId === tid)?.count ?? 0
    const lpCo = results.lp_company.find((r) => r.tenantId === tid)?.count ?? 0
    const mapCo = results.map_company.find((r) => r.tenantId === tid)?.count ?? 0
    const ordersCust = results.orders_with_customer.find((r) => r.tenantId === tid)?.count ?? 0
    const ordersLinked = results.orders_linked.find((r) => r.tenantId === tid)?.count ?? 0

    const personOk = mapPerson >= lpCust
    const companyOk = mapCo >= lpCo
    const orderOk = ordersLinked >= ordersCust || ordersCust === 0

    const status = personOk && companyOk && orderOk ? 'OK' : 'MISMATCH'
    if (status !== 'OK') allOk = false

    console.log(
      `Tenant ${tid}: lp_customer=${lpCust} mapped_person=${mapPerson} | lp_company=${lpCo} mapped_company=${mapCo} | orders_linked=${ordersLinked}/${ordersCust} → ${status}`,
    )
  }

  if (tenantIds.size === 0) {
    console.log('No tenant data found.')
  }

  return allOk
}

async function migrateCompanies(client, { dryRun, tenantId }) {
  const mapped = await getMappedLegacyIds(client, 'company', tenantId)
  const params = []
  let sql = `SELECT id, "tenantId", name, created_at, updated_at, create_by, update_by FROM lp_company`
  if (tenantId != null) {
    sql += ` WHERE "tenantId" = $1`
    params.push(tenantId)
  }
  sql += ` ORDER BY id`

  const { rows } = await client.query(sql, params)
  let created = 0
  let skipped = 0

  for (const row of rows) {
    if (mapped.has(row.id)) {
      skipped += 1
      continue
    }

    if (dryRun) {
      console.log(`[dry-run] company ${row.id} → crm_company (${row.name})`)
      created += 1
      continue
    }

    const insert = await client.query(
      `INSERT INTO crm_company ("tenantId", name, domain, links, created_at, updated_at, create_by, update_by)
       VALUES ($1, $2, NULL, '{}', $3, $4, $5, $6)
       RETURNING id`,
      [row.tenantId, row.name, row.created_at, row.updated_at, row.create_by, row.update_by],
    )
    const crmId = insert.rows[0].id

    await client.query(
      `INSERT INTO crm_id_map ("tenantId", entity_type, legacy_id, crm_id)
       VALUES ($1, 'company', $2, $3)`,
      [row.tenantId, row.id, crmId],
    )
    mapped.set(row.id, crmId)
    created += 1
  }

  console.log(`Companies: ${created} migrated, ${skipped} skipped (already mapped)`)
  return mapped
}

async function migrateCustomers(client, { dryRun, tenantId }) {
  const companyMap = await getMappedLegacyIds(client, 'company', tenantId)
  const personMap = await getMappedLegacyIds(client, 'person', tenantId)

  const params = []
  let sql = `SELECT id, "tenantId", name, phone, email, status, created_at, updated_at, create_by, update_by FROM lp_customer`
  if (tenantId != null) {
    sql += ` WHERE "tenantId" = $1`
    params.push(tenantId)
  }
  sql += ` ORDER BY id`

  const { rows } = await client.query(sql, params)
  let created = 0
  let skipped = 0

  for (const row of rows) {
    if (personMap.has(row.id)) {
      skipped += 1
      continue
    }

    const parsed = parseName(row.name)
    const primaryEmail = normalizeEmail(row.email)
    const emails = primaryEmail ? JSON.stringify([{ value: primaryEmail, isPrimary: true }]) : '[]'
    const phones = row.phone
      ? JSON.stringify([{ value: row.phone, isPrimary: true }])
      : '[]'

    if (dryRun) {
      console.log(`[dry-run] customer ${row.id} → crm_person (${row.name})`)
      created += 1
      continue
    }

    const insert = await client.query(
      `INSERT INTO crm_person (
         "tenantId", name, first_name, last_name, emails, phones,
         primary_email, primary_phone, status,
         created_at, updated_at, create_by, update_by
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        row.tenantId,
        parsed.name || row.name,
        parsed.firstName,
        parsed.lastName,
        emails,
        phones,
        primaryEmail,
        row.phone || null,
        row.status || 'ACTIVE',
        row.created_at,
        row.updated_at,
        row.create_by,
        row.update_by,
      ],
    )
    const crmId = insert.rows[0].id

    await client.query(
      `INSERT INTO crm_id_map ("tenantId", entity_type, legacy_id, crm_id)
       VALUES ($1, 'person', $2, $3)`,
      [row.tenantId, row.id, crmId],
    )
    personMap.set(row.id, crmId)
    created += 1
  }

  console.log(`Customers: ${created} migrated, ${skipped} skipped (already mapped)`)

  // M:N lp_customer_company → crm_person_company
  const linkParams = []
  let linkSql = `
    SELECT cc."customerId", cc."companyId", c."tenantId"
    FROM lp_customer_company cc
    INNER JOIN lp_customer c ON c.id = cc."customerId"
  `
  if (tenantId != null) {
    linkSql += ` WHERE c."tenantId" = $1`
    linkParams.push(tenantId)
  }

  const { rows: links } = await client.query(linkSql, linkParams)
  let linksCreated = 0

  for (const link of links) {
    const personId = personMap.get(link.customerId)
    const companyId = companyMap.get(link.companyId)
    if (!personId || !companyId) continue

    if (dryRun) {
      linksCreated += 1
      continue
    }

    await client.query(
      `INSERT INTO crm_person_company (person_id, company_id)
       VALUES ($1, $2)
       ON CONFLICT (person_id, company_id) DO NOTHING`,
      [personId, companyId],
    )
    linksCreated += 1
  }

  console.log(`Person-company links: ${linksCreated} processed`)
  return personMap
}

async function backfillOrderPersonIds(client, { dryRun, tenantId }) {
  const params = []
  let sql = `
    UPDATE lp_order o
    SET person_id = m.crm_id
    FROM crm_id_map m
    WHERE m.entity_type = 'person'
      AND m.legacy_id = o."customerId"
      AND m."tenantId" = o."tenantId"
      AND o.person_id IS NULL
      AND o."customerId" IS NOT NULL
  `
  if (tenantId != null) {
    sql += ` AND o."tenantId" = $1`
    params.push(tenantId)
  }

  if (dryRun) {
    let countQuery = `
      SELECT COUNT(*)::int AS count FROM lp_order o
      INNER JOIN crm_id_map m
        ON m.entity_type = 'person'
        AND m.legacy_id = o."customerId"
        AND m."tenantId" = o."tenantId"
      WHERE o.person_id IS NULL AND o."customerId" IS NOT NULL
    `
    if (tenantId != null) countQuery += ` AND o."tenantId" = $1`
    const { rows } = await client.query(countQuery, params)
    console.log(`Orders person_id backfill: ${rows[0].count} would be updated (dry-run)`)
    return rows[0].count
  }

  const result = await client.query(sql, params)
  console.log(`Orders person_id backfill: ${result.rowCount} updated`)
  return result.rowCount
}

async function migrateCustomFields(client, { dryRun, tenantId }) {
  if (!(await tableExists(client, 'crm_custom_field_def'))) {
    console.log('Custom fields: skipped (crm_custom_field_def not found — run Phase 7 migration)')
    return
  }

  const fieldMap = await getMappedLegacyIds(client, 'custom_field_def', tenantId)
  const params = []
  let sql = `SELECT id, "tenantId", "fieldName", "displayName", "dataType", description, options, created_at, updated_at, create_by, update_by
    FROM lp_customer_custom_field`
  if (tenantId != null) {
    sql += ` WHERE "tenantId" = $1`
    params.push(tenantId)
  }
  sql += ` ORDER BY id`

  const { rows } = await client.query(sql, params)
  let created = 0
  let skipped = 0

  for (const row of rows) {
    if (fieldMap.has(row.id)) {
      skipped += 1
      continue
    }

    const optionsJson = row.options ? JSON.stringify(row.options) : null

    if (dryRun) {
      console.log(`[dry-run] custom_field ${row.id} → crm_custom_field_def (${row.fieldName})`)
      created += 1
      continue
    }

    const insert = await client.query(
      `INSERT INTO crm_custom_field_def (
         "tenantId", target_type, field_name, display_name, data_type, description, options,
         created_at, updated_at, create_by, update_by
       ) VALUES ($1,'person',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)
       RETURNING id`,
      [
        row.tenantId,
        row.fieldName,
        row.displayName,
        row.dataType || 'TEXT',
        row.description,
        optionsJson,
        row.created_at,
        row.updated_at,
        row.create_by,
        row.update_by,
      ],
    )
    const crmId = insert.rows[0].id
    await client.query(
      `INSERT INTO crm_id_map ("tenantId", entity_type, legacy_id, crm_id) VALUES ($1,'custom_field_def',$2,$3)`,
      [row.tenantId, row.id, crmId],
    )
    fieldMap.set(row.id, crmId)
    created += 1
  }

  console.log(`Custom fields: ${created} migrated, ${skipped} skipped`)

  // Values
  let valuesCreated = 0
  if (!dryRun && fieldMap.size) {
    const { rows: values } = await client.query(`
      SELECT v."customerId", v."fieldId", v.value, c."tenantId"
      FROM lp_customer_field_value v
      INNER JOIN lp_customer c ON c.id = v."customerId"
    `)
    const personMap = await getMappedLegacyIds(client, 'person', tenantId)

    for (const val of values) {
      const personId = personMap.get(val.customerId)
      const fieldId = fieldMap.get(val.fieldId)
      if (!personId || !fieldId) continue

      await client.query(
        `INSERT INTO crm_custom_field_value (field_id, person_id, value)
         VALUES ($1,$2,$3)
         ON CONFLICT (field_id, person_id) DO NOTHING`,
        [fieldId, personId, val.value],
      )
      valuesCreated += 1
    }
  }
  console.log(`Custom field values: ${valuesCreated} processed`)
}

async function main() {
  loadEnv()
  const { dryRun, validateOnly, tenantId } = parseArgs()

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

  try {
    const required = ['crm_person', 'crm_company', 'crm_id_map', 'lp_customer', 'lp_company']
    for (const t of required) {
      if (!(await tableExists(client, t))) {
        console.error(`Missing table: ${t}. Run pnpm db:migration:run first.`)
        process.exit(1)
      }
    }

    if (validateOnly) {
      const ok = await validateCounts(client, tenantId)
      process.exit(ok ? 0 : 1)
    }

    console.log(`CRM data migration${dryRun ? ' (DRY RUN)' : ''}${tenantId != null ? ` tenant=${tenantId}` : ''}`)
    console.log('---')

    if (!dryRun) await client.query('BEGIN')

    await migrateCompanies(client, { dryRun, tenantId })
    await migrateCustomers(client, { dryRun, tenantId })
    await backfillOrderPersonIds(client, { dryRun, tenantId })
    await migrateCustomFields(client, { dryRun, tenantId })

    if (!dryRun) await client.query('COMMIT')

    const ok = await validateCounts(client, tenantId)
    if (!ok) {
      console.error('\nValidation reported mismatches. Review before enabling CRM_ENABLED=true.')
      process.exit(1)
    }

    console.log('\nMigration complete.')
    if (!dryRun) {
      console.log('Next: set CRM_ENABLED=true and restart ladipage-backend.')
      console.log('Rollback: CRM_ENABLED=false (crm_id_map retained).')
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore
    }
    console.error(err)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()