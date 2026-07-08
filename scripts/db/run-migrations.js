/**
 * Run TypeORM migrations.
 * Usage: node scripts/db/run-migrations.js
 */
require('dotenv').config()
require('./resolve-migration-env').resolveMigrationEnv()
require('ts-node').register({
  project: require('node:path').join(__dirname, '../../libs/database/tsconfig.cli.json'),
  transpileOnly: true,
})

async function main() {
  const dataSource = require('../../libs/database/src/data-source.ts')
  const ds = dataSource.default || dataSource

  await ds.initialize()
  console.log('Connected:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'))

  const applied = await ds.runMigrations({ transaction: 'each' })
  console.log(`Applied ${applied.length} migration(s):`)
  applied.forEach(m => console.log(' -', m.name))

  await ds.destroy()
}

main().catch((err) => {
  console.error('Migration failed:', err.message || err)
  process.exit(1)
})