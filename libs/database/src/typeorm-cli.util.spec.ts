import { buildCliDataSourceOptions, resolveMonorepoRoot } from './typeorm-cli.util'

describe('typeorm-cli.util', () => {
  it('resolves monorepo root from libs/database/src', () => {
    const root = resolveMonorepoRoot()
    expect(root.endsWith('liora-monorepo') || root.includes('liora-monorepo')).toBe(true)
  })

  it('points CLI entities at nest-core and migrations at database lib', () => {
    process.env.DB_TYPE = 'postgres'
    process.env.DATABASE_URL = 'postgresql://postgres:pw@localhost:5432/liora_db'

    const options = buildCliDataSourceOptions()
    const entities = options.entities as string[]
    const migrations = options.migrations as string[]

    expect(options.type).toBe('postgres')
    expect(entities.some(e => e.includes('nest-core') && e.includes('entity.ts'))).toBe(true)
    expect(migrations.some(m => m.includes('database') && m.includes('migrations'))).toBe(true)
    expect(options.migrationsTableName).toBe('typeorm_migrations')
  })
})