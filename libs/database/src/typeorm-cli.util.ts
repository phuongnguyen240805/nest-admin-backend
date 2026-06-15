import { join } from 'node:path'

import type { DataSourceOptions } from 'typeorm'

import { buildDataSourceOptions } from './utils/connection-url.util'

/** Monorepo root (liora-monorepo/) */
export function resolveMonorepoRoot(): string {
  return join(__dirname, '../../..')
}

/** Entity + migration globs for TypeORM CLI (source .ts files). */
export function buildCliDataSourceOptions(): DataSourceOptions {
  const root = resolveMonorepoRoot()

  return {
    ...buildDataSourceOptions(),
    entities: [
      join(root, 'libs/nest-core/src/**/*.entity.ts'),
      join(root, 'libs/database/src/**/*.entity.ts'),
    ],
    migrations: [join(__dirname, 'migrations/*.ts')],
    migrationsTableName: 'typeorm_migrations',
  }
}