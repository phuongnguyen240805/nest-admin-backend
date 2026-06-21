import { existsSync } from 'node:fs'
import { join } from 'node:path'

function envCandidates(baseDir: string): string[] {
  const nodeEnv = process.env['NODE_ENV'] ?? 'development'
  return [
    join(baseDir, '.env.local'),
    join(baseDir, `.env.${nodeEnv}`),
    join(baseDir, '.env'),
  ]
}

function existingOnly(paths: string[]): string[] {
  return paths.filter((path) => existsSync(path))
}

/**
 * Resolve env files for NestJS ConfigModule.
 *
 * Load order (later overrides earlier):
 * 1. Root workspace — shared libs (database, nest-core, supabase, stripe, librefang, …)
 * 2. App directory — app-only vars (PORT, feature flags, …)
 */
export function resolveWorkspaceEnvPaths(appDir: string): string[] {
  const workspaceRoot = process.cwd()
  const appRoot = join(workspaceRoot, 'apps', appDir)

  return existingOnly([
    ...envCandidates(workspaceRoot),
    ...envCandidates(appRoot),
  ])
}