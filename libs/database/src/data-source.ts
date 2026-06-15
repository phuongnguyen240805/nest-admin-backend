/**
 * TypeORM CLI entrypoint — CommonJS exports for Node CLI compatibility.
 */
require('dotenv/config')

const Module = require('node:module')
const { join } = require('node:path')
const { DataSource } = require('typeorm')
const { buildDataSourceOptions } = require('./utils/connection-url.util')

const MONOREPO_ROOT = join(__dirname, '../../..')

function registerMonorepoPathAliases() {
  const aliases = {
    '~': join(MONOREPO_ROOT, 'libs/nest-core/src'),
    '@liora/database': join(MONOREPO_ROOT, 'libs/database/src/index.ts'),
    '@liora/supabase': join(MONOREPO_ROOT, 'libs/supabase/src/index.ts'),
  }

  const moduleAny = Module
  const originalResolve = moduleAny._resolveFilename

  moduleAny._resolveFilename = function (request, parent, isMain, options) {
    for (const [prefix, target] of Object.entries(aliases)) {
      if (request === prefix || request.startsWith(`${prefix}/`)) {
        const subpath = request === prefix ? '' : request.slice(prefix.length + 1)
        const resolved = subpath ? join(String(target).replace(/index\.ts$/, ''), subpath) : target
        try {
          return originalResolve.call(this, resolved, parent, isMain, options)
        }
        catch {
          return originalResolve.call(this, `${resolved}.ts`, parent, isMain, options)
        }
      }
    }

    if (request.startsWith('@liora/')) {
      const withoutScope = request.slice('@liora/'.length)
      const [pkg, ...rest] = withoutScope.split('/')
      const base = join(MONOREPO_ROOT, 'libs', pkg, 'src')
      const resolved = rest.length ? join(base, ...rest) : join(base, 'index.ts')
      try {
        return originalResolve.call(this, resolved, parent, isMain, options)
      }
      catch {
        return originalResolve.call(this, `${resolved}.ts`, parent, isMain, options)
      }
    }

    return originalResolve.call(this, request, parent, isMain, options)
  }
}

registerMonorepoPathAliases()

const dataSource = new DataSource({
  ...buildDataSourceOptions(),
  entities: [join(MONOREPO_ROOT, 'libs/nest-core/src/**/*.entity.ts')],
  migrations: [join(__dirname, 'migrations/*.ts')],
  migrationsTableName: 'typeorm_migrations',
})

module.exports = dataSource
module.exports.default = dataSource