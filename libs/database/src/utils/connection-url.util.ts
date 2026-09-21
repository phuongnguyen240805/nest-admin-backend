import type { RedisOptions } from 'ioredis'
import type { DataSourceOptions } from 'typeorm'

import { env, envBoolean, envNumber } from '../global/env'

export type DatabaseDriver = 'mysql' | 'postgres'

export interface ParsedDatabaseConnection {
  host: string
  port: number
  username: string
  password: string
  database: string
}

function resolveDatabaseDriver(): DatabaseDriver {
  const dbType = (process.env['DB_TYPE'] ?? 'mysql').toLowerCase()
  if (dbType === 'postgres' || dbType === 'postgresql')
    return 'postgres'
  return 'mysql'
}

function inferDriverFromDatabaseUrl(databaseUrl: string): DatabaseDriver | null {
  const protocol = new URL(databaseUrl).protocol
  if (['postgresql:', 'postgres:'].includes(protocol))
    return 'postgres'
  if (['mysql:', 'mysql2:'].includes(protocol))
    return 'mysql'
  return null
}

export function parseMysqlDatabaseUrl(databaseUrl: string): ParsedDatabaseConnection {
  const url = new URL(databaseUrl)

  if (!['mysql:', 'mysql2:'].includes(url.protocol)) {
    throw new Error(`MySQL DATABASE_URL must use mysql:// or mysql2:// (got ${url.protocol})`)
  }

  const database = url.pathname.replace(/^\//, '')
  if (!database)
    throw new Error('DATABASE_URL must include a database name')

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  }
}

export function parsePostgresDatabaseUrl(databaseUrl: string): ParsedDatabaseConnection {
  const url = new URL(databaseUrl)

  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    throw new Error(`PostgreSQL DATABASE_URL must use postgresql:// or postgres:// (got ${url.protocol})`)
  }

  const database = url.pathname.replace(/^\//, '')
  if (!database)
    throw new Error('DATABASE_URL must include a database name')

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  }
}

/** @deprecated Use parseMysqlDatabaseUrl */
export function parseDatabaseUrl(databaseUrl: string): ParsedDatabaseConnection {
  return parseMysqlDatabaseUrl(databaseUrl)
}

export function parseRedisUrl(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl)

  if (!['redis:', 'rediss:'].includes(url.protocol)) {
    throw new Error(`REDIS_URL must use redis:// or rediss:// (got ${url.protocol})`)
  }

  const pathname = url.pathname.replace(/^\//, '')
  const db = pathname ? Number(pathname) : 0

  const options: RedisOptions = {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    db: Number.isNaN(db) ? 0 : db,
  }

  if (url.password)
    options.password = decodeURIComponent(url.password)

  if (url.username)
    options.username = decodeURIComponent(url.username)

  if (url.protocol === 'rediss:')
    options.tls = {}

  return options
}

function resolveDbHost(): string {
  const host = process.env.DB_HOST
  if (host)
    return host

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DB_HOST or DATABASE_URL must be set in production')
  }

  return '127.0.0.1'
}

function resolveRedisHost(): string {
  const host = process.env.REDIS_HOST
  if (host)
    return host

  if (process.env.NODE_ENV === 'production') {
    throw new Error('REDIS_HOST or REDIS_URL must be set in production')
  }

  return '127.0.0.1'
}

function sharedOrmPaths(): Pick<DataSourceOptions, 'entities' | 'migrations' | 'subscribers'> {
  return {
    entities: ['dist/modules/**/*.entity{.ts,.js}'],
    migrations: ['dist/migrations/*{.ts,.js}'],
    subscribers: ['dist/modules/**/*.subscriber{.ts,.js}'],
  }
}

function resolvePostgresSsl(): boolean | { rejectUnauthorized: boolean } | undefined {
  const sslEnabled = envBoolean('DB_SSL', false)
  if (!sslEnabled)
    return undefined

  return {
    rejectUnauthorized: envBoolean('DB_SSL_REJECT_UNAUTHORIZED', false),
  }
}

const SUPABASE_SESSION_POOLER_PORT = 5432
const SUPABASE_TRANSACTION_POOLER_PORT = 6543

function isSupabasePoolerHost(host: string): boolean {
  return host === 'pooler.supabase.com' || host.endsWith('.pooler.supabase.com')
}

/** Session-mode pooler (5432) holds one Postgres backend per client TCP. */
export function resolvePostgresPoolerPort(host: string, port: number): number {
  const mode = (process.env['DB_POOLER_MODE'] ?? '').toLowerCase()
  if (mode !== 'transaction')
    return port
  if (!isSupabasePoolerHost(host) || port !== SUPABASE_SESSION_POOLER_PORT)
    return port
  return SUPABASE_TRANSACTION_POOLER_PORT
}

function resolvePostgresPoolExtra(host: string): Record<string, unknown> {
  const pooler = isSupabasePoolerHost(host)
  const defaultMax = pooler ? 5 : 10
  return {
    max: envNumber('DB_POOL_MAX', defaultMax),
    idleTimeoutMillis: envNumber('DB_POOL_IDLE_MS', pooler ? 20_000 : 30_000),
    connectionTimeoutMillis: envNumber('DB_POOL_CONNECT_MS', 10_000),
    allowExitOnIdle: true,
  }
}

export function buildPostgresDataSourceOptions(): DataSourceOptions {
  const databaseUrl = process.env.DATABASE_URL
  const ssl = resolvePostgresSsl()
  const paths = sharedOrmPaths()
  const synchronize = envBoolean('DB_SYNCHRONIZE', false)

  if (databaseUrl) {
    const parsed = parsePostgresDatabaseUrl(databaseUrl)
    const port = resolvePostgresPoolerPort(parsed.host, parsed.port)
    return {
      type: 'postgres',
      synchronize,
      ...paths,
      ssl,
      host: parsed.host,
      port,
      username: parsed.username,
      password: parsed.password,
      database: parsed.database,
      extra: resolvePostgresPoolExtra(parsed.host),
    }
  }

  const host = resolveDbHost()
  return {
    type: 'postgres',
    synchronize,
    ...paths,
    ssl,
    host,
    port: envNumber('DB_PORT', 5432),
    username: env('DB_USERNAME'),
    password: env('DB_PASSWORD'),
    database: env('DB_DATABASE'),
    extra: resolvePostgresPoolExtra(host),
  }
}

export function buildMysqlDataSourceOptions(): DataSourceOptions {
  const currentScript = process.env.npm_lifecycle_event
  const databaseUrl = process.env.DATABASE_URL

  const base: DataSourceOptions = {
    type: 'mysql',
    synchronize: envBoolean('DB_SYNCHRONIZE', false),
    multipleStatements: currentScript === 'typeorm',
    ...sharedOrmPaths(),
  }

  if (databaseUrl) {
    const parsed = parseMysqlDatabaseUrl(databaseUrl)
    return {
      ...base,
      host: parsed.host,
      port: parsed.port,
      username: parsed.username,
      password: parsed.password,
      database: parsed.database,
    }
  }

  return {
    ...base,
    host: resolveDbHost(),
    port: envNumber('DB_PORT', 3306),
    username: env('DB_USERNAME'),
    password: env('DB_PASSWORD'),
    database: env('DB_DATABASE'),
  }
}

/**
 * Build TypeORM options from DB_TYPE / DATABASE_URL.
 * Defaults to mysql for backward compatibility.
 */
export function buildDataSourceOptions(): DataSourceOptions {
  const databaseUrl = process.env.DATABASE_URL
  const driver = databaseUrl
    ? (inferDriverFromDatabaseUrl(databaseUrl) ?? resolveDatabaseDriver())
    : resolveDatabaseDriver()

  return driver === 'postgres'
    ? buildPostgresDataSourceOptions()
    : buildMysqlDataSourceOptions()
}

export function buildRedisOptions(): RedisOptions {
  const redisUrl = process.env.REDIS_URL

  if (redisUrl)
    return parseRedisUrl(redisUrl)

  return {
    host: resolveRedisHost(),
    port: envNumber('REDIS_PORT', 6379),
    password: env('REDIS_PASSWORD') || undefined,
    db: envNumber('REDIS_DB', 0),
  }
}