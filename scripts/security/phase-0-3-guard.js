#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const cwd = process.cwd()
const failures = []

function read(relativePath) {
  return fs.readFileSync(path.join(cwd, relativePath), 'utf8')
}

function mustContain(relativePath, pattern, message) {
  if (!pattern.test(read(relativePath))) failures.push(`${relativePath}: ${message}`)
}

function mustNotContain(relativePath, pattern, message) {
  if (pattern.test(read(relativePath))) failures.push(`${relativePath}: ${message}`)
}

mustContain(
  'apps/ladipage-backend/src/main.ts',
  /origin:\s*ladipageCorsOrigin/,
  'HTTP CORS must use the explicit allowlist callback',
)
mustNotContain(
  'apps/ladipage-backend/src/main.ts',
  /origin:\s*["']\*["']/,
  'credentialed CORS must never use a wildcard origin',
)
mustNotContain(
  'libs/nest-core/src/common/adapters/fastify.adapter.ts',
  /^(?!\s*\/\/).*request\.headers\.origin\s*=/m,
  'the backend must not synthesize Origin from Host',
)
mustContain(
  'libs/nest-core/src/modules/auth/services/token.service.ts',
  /secret:\s*this\.securityConfig\.refreshSecret/,
  'realtime tickets must not use the REST access-token signing secret',
)
mustContain(
  'libs/nest-core/src/modules/auth/services/token.service.ts',
  /audience:\s*CUSTOMER_CARE_REALTIME_AUDIENCE/,
  'realtime tickets must have a dedicated audience',
)
mustContain(
  'libs/nest-core/src/modules/auth/services/token.service.ts',
  /purpose:\s*['"]customer-care-realtime['"]/,
  'realtime tickets must have an explicit purpose',
)
mustContain(
  'libs/nest-core/src/modules/auth/controllers/account.controller.ts',
  /@Post\(['"]realtime-ticket['"]\)/,
  'realtime ticket issuance must be a protected POST endpoint',
)
mustContain(
  'apps/ladipage-backend/src/modules/customer-care/customer-care.gateway.ts',
  /verifyCustomerCareRealtimeTicket/,
  'Customer Care websocket must verify the scoped realtime ticket',
)
mustNotContain(
  'apps/ladipage-backend/src/modules/customer-care/customer-care.gateway.ts',
  /headers\.authorization|JwtService/,
  'Customer Care websocket must not accept credentials from Authorization headers',
)
mustContain(
  'apps/ladipage-backend/src/modules/customer-care/customer-care.gateway.ts',
  /CUSTOMER_CARE_LEGACY_SOCKET_JWT_ENABLED\s*===\s*['"]true['"]/,
  'legacy websocket JWT compatibility must stay behind an explicit migration flag',
)
mustContain(
  'apps/ladipage-backend/src/modules/customer-care/customer-care.gateway.ts',
  /origin:\s*ladipageCorsOrigin/,
  'websocket CORS must use the same exact allowlist policy',
)

if (failures.length) {
  console.error(`Phase 0-3 backend guard failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('Phase 0-3 backend guard passed.')
