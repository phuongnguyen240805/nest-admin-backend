import type { RedisOptions } from 'ioredis'
import type { DataSourceOptions } from 'typeorm'

import { env, envBoolean, envNumber } from '../global/env'

export interface ParsedDatabaseConnection {
  host: string
  port: number
  username: string
  password: string
  database: string
}

export function parseDatabaseUrl(databaseUrl: string): ParsedDatabaseConnection {
  const url = new URL(databaseUrl)

  if (!['mysql:', 'mysql2:'].includes(url.protocol)) {
    throw new Error(`DATABASE_URL must use mysql:// or mysql2:// (got ${url.protocol})`)
  }

  const database = url.pathname.replace(/^\//, '')
  if (!database) {
    throw new Error('DATABASE_URL must include a database name')
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  }
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

export function buildMysqlDataSourceOptions(): DataSourceOptions {
  const currentScript = process.env.npm_lifecycle_event
  const databaseUrl = process.env.DATABASE_URL

  const base: DataSourceOptions = {
    type: 'mysql',
    synchronize: envBoolean('DB_SYNCHRONIZE', false),
    multipleStatements: currentScript === 'typeorm',
    entities: ['dist/modules/**/*.entity{.ts,.js}'],
    migrations: ['dist/migrations/*{.ts,.js}'],
    subscribers: ['dist/modules/**/*.subscriber{.ts,.js}'],
  }

  if (databaseUrl) {
    const parsed = parseDatabaseUrl(databaseUrl)
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
