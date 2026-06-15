/**
 * Phase 7.3 — Backfill sys_user.supabase_user_id via Supabase Admin API.
 * Usage:
 *   node scripts/migration/backfill-supabase-users.js --dry-run
 *   node scripts/migration/backfill-supabase-users.js --apply
 */
require('dotenv').config()
const { createPgClient } = require('./lib/pg-client')

const dryRun = !process.argv.includes('--apply')
const prioritizeAdmins = !process.argv.includes('--all-users')

async function main() {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    console.error('Need SUPABASE_URL and SUPABASE_SECRET_KEY')
    process.exit(1)
  }

  const { createClient } = require('@supabase/supabase-js')
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const pg = createPgClient()
  await pg.connect()

  let query = `
    SELECT id, username, email, "isSuperAdmin"
    FROM sys_user
    WHERE supabase_user_id IS NULL
      AND email IS NOT NULL AND email <> ''
  `
  if (prioritizeAdmins) {
    query += ` ORDER BY "isSuperAdmin" DESC, id ASC`
  }

  const { rows: users } = await pg.query(query)

  console.log(`=== Phase 7.3 — Backfill supabase_user_id (${dryRun ? 'DRY-RUN' : 'APPLY'}) ===\n`)
  console.log(`Candidates: ${users.length}\n`)

  const report = { linked: 0, skipped: 0, failed: 0, details: [] }

  for (const user of users) {
    const entry = { id: user.id, username: user.username, email: user.email }

    try {
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 })
      const existing = list?.users?.find(u => u.email === user.email)

      let supabaseUserId

      if (existing) {
        supabaseUserId = existing.id
        entry.action = 'link-existing'
      }
      else if (dryRun) {
        entry.action = 'would-create'
        report.skipped++
        report.details.push(entry)
        console.log(`[dry-run] CREATE ${user.email} → sys_user#${user.id}`)
        continue
      }
      else {
        const tempPassword = `Liora_${user.id}_${Date.now().toString(36)}!A1`
        const { data, error } = await admin.auth.admin.createUser({
          email: user.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { sys_user_id: user.id, username: user.username },
        })
        if (error) throw error
        supabaseUserId = data.user.id
        entry.action = 'created'
      }

      if (!dryRun) {
        await pg.query(
          'UPDATE sys_user SET supabase_user_id = $1 WHERE id = $2',
          [supabaseUserId, user.id],
        )
      }

      entry.supabaseUserId = supabaseUserId
      report.linked++
      report.details.push(entry)
      console.log(`[${entry.action}] ${user.email} → ${supabaseUserId}`)
    }
    catch (err) {
      entry.error = err.message
      report.failed++
      report.details.push(entry)
      console.error(`[FAIL] ${user.email}: ${err.message}`)
    }
  }

  const noEmail = await pg.query(`
    SELECT id, username FROM sys_user
    WHERE supabase_user_id IS NULL AND (email IS NULL OR email = '')
  `)

  console.log('\n=== Report ===')
  console.log(`Linked: ${report.linked}`)
  console.log(`Skipped (dry-run): ${report.skipped}`)
  console.log(`Failed: ${report.failed}`)
  console.log(`No email (manual): ${noEmail.rows.length}`)
  for (const u of noEmail.rows) {
    console.log(`  - sys_user#${u.id} ${u.username}`)
  }

  await pg.end()

  if (report.failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})