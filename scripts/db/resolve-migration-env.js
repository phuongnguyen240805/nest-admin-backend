/**
 * Adjust DB connection env when migration scripts run inside Docker Compose.
 * Host `.env` often uses localhost:5432; inside a container that must be the `db` service.
 */
const fs = require('node:fs')

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

function isRunningInDocker() {
  return (
    process.env.RUNNING_IN_DOCKER === '1'
    || fs.existsSync('/.dockerenv')
  )
}

function dockerDbHost() {
  return process.env.DOCKER_DB_HOST || 'db'
}

function shouldRewriteHost(hostname) {
  if (process.env.MIGRATE_DISABLE_DOCKER_REWRITE === '1') return false
  return LOCAL_HOSTS.has(hostname)
}

function rewriteDatabaseUrl(databaseUrl) {
  const url = new URL(databaseUrl)
  if (!shouldRewriteHost(url.hostname)) return databaseUrl

  url.hostname = dockerDbHost()
  if (!url.port) {
    url.port = url.protocol === 'postgresql:' || url.protocol === 'postgres:' ? '5432' : ''
  }

  return url.toString()
}

function resolveMigrationEnv() {
  if (!isRunningInDocker()) return

  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    try {
      const rewritten = rewriteDatabaseUrl(databaseUrl)
      if (rewritten !== databaseUrl) {
        process.env.DATABASE_URL = rewritten
        if (process.env.DB_SSL === undefined) process.env.DB_SSL = 'false'
        console.log(`[migrate] Docker: DATABASE_URL host → ${dockerDbHost()}`)
      }
    } catch {
      // keep original DATABASE_URL
    }
    return
  }

  const host = process.env.DB_HOST
  if (host && !shouldRewriteHost(host)) return

  process.env.DB_HOST = dockerDbHost()
  if (process.env.DB_SSL === undefined) process.env.DB_SSL = 'false'
  console.log(`[migrate] Docker: DB_HOST → ${process.env.DB_HOST}`)
}

module.exports = {
  resolveMigrationEnv,
  isRunningInDocker,
  rewriteDatabaseUrl,
}