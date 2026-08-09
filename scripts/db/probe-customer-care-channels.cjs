const fs = require('node:fs')
const dotenv = require('dotenv')
const { Client } = require('pg')

const parsed = dotenv.parse(fs.readFileSync('/app/.env'))
const client = new Client({ connectionString: parsed.DATABASE_URL })

async function main() {
  await client.connect()
  const columns = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'cc_channel_account'
    ORDER BY ordinal_position
  `)
  const hasConnectionKey = columns.rows.some((row) => row.column_name === 'connection_key')
  const channels = hasConnectionKey
    ? await client.query('SELECT id, tenant_id, provider, connection_key IS NOT NULL AS has_connection_key FROM cc_channel_account ORDER BY id')
    : await client.query('SELECT id, tenant_id, provider, false AS has_connection_key FROM cc_channel_account ORDER BY id')
  console.log(JSON.stringify({ hasConnectionKey, channels: channels.rows }))
  await client.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
