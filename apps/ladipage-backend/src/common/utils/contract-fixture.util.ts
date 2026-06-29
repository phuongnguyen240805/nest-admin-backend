import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

interface ContractFixture<TData = unknown> {
  request?: Record<string, unknown>
  requestHeaders?: Record<string, string>
  response?: {
    data?: TData
  }
}

export function loadContractFixtureData<TData>(
  phase: string,
  fileName: string,
): TData {
  const path = join(resolveFixtureDir(phase), fileName)
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as ContractFixture<TData>
  return clone(fixture.response?.data) as TData
}

export function loadContractFixture<TData>(
  phase: string,
  fileName: string,
): ContractFixture<TData> {
  const path = join(resolveFixtureDir(phase), fileName)
  return JSON.parse(readFileSync(path, 'utf8')) as ContractFixture<TData>
}

function resolveFixtureDir(phase: string): string {
  const workspaceRelative = join(
    'apps',
    'ladipage-backend',
    'test',
    'contract',
    'fixtures',
    phase,
  )
  const appRelative = join('test', 'contract', 'fixtures', phase)
  let current = process.cwd()

  for (let index = 0; index < 6; index += 1) {
    const workspaceCandidate = join(current, workspaceRelative)
    if (existsSync(workspaceCandidate)) return workspaceCandidate

    const appCandidate = join(current, appRelative)
    if (existsSync(appCandidate)) return appCandidate

    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }

  return join(process.cwd(), workspaceRelative)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T
}
