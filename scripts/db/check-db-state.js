require('dotenv').config()
const { Client } = require('pg')

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()

  const migrations = await client.query(`
    SELECT * FROM typeorm_migrations ORDER BY id
  `).catch(() => ({ rows: [], error: 'typeorm_migrations table missing' }))

  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)

  console.log('=== typeorm_migrations ===')
  if (migrations.error) console.log(migrations.error)
  else console.log(migrations.rows)

  console.log('\n=== public tables ===')
  console.log(tables.rows.map(r => r.table_name).join('\n'))

  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })