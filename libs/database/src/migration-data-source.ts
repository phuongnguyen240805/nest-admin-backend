/**
 * Migration-only TypeORM DataSource.
 *
 * Deliberately has no entities: running already-authored migrations only needs
 * the migration classes. Avoiding entity discovery keeps the CLI independent
 * from Nest/Swagger runtime packages and prevents unrelated application
 * imports from blocking database upgrades.
 */
require('dotenv/config')
require('../../../scripts/db/resolve-migration-env').resolveMigrationEnv()

const { join } = require('node:path')
const { DataSource } = require('typeorm')
const { buildDataSourceOptions } = require('./utils/connection-url.util')

const dataSource = new DataSource({
  ...buildDataSourceOptions(),
  entities: [],
  migrations: [join(__dirname, 'migrations/*.ts')],
  migrationsTableName: 'typeorm_migrations',
})

module.exports = dataSource
module.exports.default = dataSource
