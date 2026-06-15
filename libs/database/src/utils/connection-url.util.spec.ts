import {
  buildDataSourceOptions,
  buildMysqlDataSourceOptions,
  buildPostgresDataSourceOptions,
  parseMysqlDatabaseUrl,
  parsePostgresDatabaseUrl,
} from './connection-url.util'

const ORIGINAL_ENV = process.env

function restoreEnv(): void {
  process.env = { ...ORIGINAL_ENV }
}

describe('connection-url.util', () => {
  afterEach(() => {
    restoreEnv()
  })

  describe('parsePostgresDatabaseUrl', () => {
    it('parses postgresql URL with explicit port', () => {
      const parsed = parsePostgresDatabaseUrl(
        'postgresql://postgres:secret@db.example.com:5432/liora_db',
      )
      expect(parsed).toEqual({
        host: 'db.example.com',
        port: 5432,
        username: 'postgres',
        password: 'secret',
        database: 'liora_db',
      })
    })

    it('defaults port to 5432 when omitted', () => {
      const parsed = parsePostgresDatabaseUrl('postgres://user:pass@localhost/app')
      expect(parsed.port).toBe(5432)
    })

    it('rejects mysql protocol', () => {
      expect(() => parsePostgresDatabaseUrl('mysql://u:p@h:3306/db')).toThrow(
        /postgresql:\/\/ or postgres:\/\//,
      )
    })
  })

  describe('parseMysqlDatabaseUrl', () => {
    it('parses mysql URL', () => {
      const parsed = parseMysqlDatabaseUrl('mysql://root:pw@127.0.0.1:3307/liora_db')
      expect(parsed.database).toBe('liora_db')
      expect(parsed.port).toBe(3307)
    })
  })

  describe('buildDataSourceOptions', () => {
    it('selects postgres when DB_TYPE=postgres', () => {
      process.env.DB_TYPE = 'postgres'
      process.env.DB_HOST = 'localhost'
      process.env.DB_PORT = '5432'
      process.env.DB_USERNAME = 'postgres'
      process.env.DB_PASSWORD = 'postgres'
      process.env.DB_DATABASE = 'liora_db'
      delete process.env.DATABASE_URL

      const options = buildDataSourceOptions()
      expect(options.type).toBe('postgres')
    })

    it('auto-detects postgres from DATABASE_URL', () => {
      delete process.env.DB_TYPE
      process.env.DATABASE_URL = 'postgresql://postgres:pw@pooler.supabase.com:6543/postgres'

      const options = buildDataSourceOptions()
      expect(options.type).toBe('postgres')
      expect(options).toMatchObject({
        host: 'pooler.supabase.com',
        port: 6543,
        database: 'postgres',
      })
    })

    it('defaults to mysql when DB_TYPE unset and no DATABASE_URL', () => {
      delete process.env.DB_TYPE
      delete process.env.DATABASE_URL
      process.env.DB_HOST = '127.0.0.1'
      process.env.DB_PORT = '3306'
      process.env.DB_USERNAME = 'root'
      process.env.DB_PASSWORD = 'root'
      process.env.DB_DATABASE = 'liora_db'

      const options = buildDataSourceOptions()
      expect(options.type).toBe('mysql')
    })

    it('enables SSL for postgres when DB_SSL=true', () => {
      process.env.DB_TYPE = 'postgres'
      process.env.DB_SSL = 'true'
      process.env.DB_SSL_REJECT_UNAUTHORIZED = 'false'
      process.env.DB_HOST = 'localhost'
      process.env.DB_USERNAME = 'postgres'
      process.env.DB_PASSWORD = 'postgres'
      process.env.DB_DATABASE = 'liora_db'
      delete process.env.DATABASE_URL

      const options = buildPostgresDataSourceOptions() as { ssl?: { rejectUnauthorized: boolean } }
      expect(options.ssl).toEqual({ rejectUnauthorized: false })
    })
  })

  describe('buildMysqlDataSourceOptions', () => {
    it('keeps multipleStatements for typeorm CLI script', () => {
      process.env.npm_lifecycle_event = 'typeorm'
      process.env.DB_HOST = '127.0.0.1'
      process.env.DB_PORT = '3306'
      process.env.DB_USERNAME = 'root'
      process.env.DB_PASSWORD = 'root'
      process.env.DB_DATABASE = 'liora_db'
      delete process.env.DATABASE_URL

      const options = buildMysqlDataSourceOptions()
      expect(options).toMatchObject({ type: 'mysql', multipleStatements: true })
    })
  })
})