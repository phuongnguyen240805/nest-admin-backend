const fs = require('fs')
const path = require('path')

const root = process.cwd()
const checks = []
const resolve = file => path.join(root, file)
const exists = file => fs.existsSync(resolve(file))
const read = file => fs.readFileSync(resolve(file), 'utf8')
const check = (ok, message) => checks.push([Boolean(ok), message])
const requireFile = file => check(exists(file), `${file}: required Phase 12 boundary file must exist`)
const requireText = (file, text, why) => {
  requireFile(file)
  if (exists(file)) check(read(file).includes(text), `${file}: ${why}`)
}
const forbidText = (file, text, why) => {
  requireFile(file)
  if (exists(file)) check(!read(file).includes(text), `${file}: ${why}`)
}
const forbidPattern = (file, pattern, why) => {
  requireFile(file)
  if (exists(file)) check(!pattern.test(read(file)), `${file}: ${why}`)
}

const controller = 'apps/ladipage-backend/src/modules/ai-seo/controllers/ai-seo-lab-scans.controller.ts'
const policy = 'apps/ladipage-backend/src/modules/ai-seo/utils/unlighthouse-url-policy.ts'
const runner = 'apps/ladipage-backend/src/modules/ai-seo/services/unlighthouse.runner.ts'
const quota = 'apps/ladipage-backend/src/modules/ai-seo/services/ai-seo-quota.service.ts'
const keywords = 'apps/ladipage-backend/src/modules/ai-seo/services/ai-seo-keywords.service.ts'
const observability = 'apps/ladipage-backend/src/common/interceptors/request-observability.interceptor.ts'
const appModule = 'apps/ladipage-backend/src/app/app.module.ts'
const main = 'apps/ladipage-backend/src/main.ts'
const legacyAuth = 'libs/nest-core/src/modules/auth/auth.service.ts'
const authController = 'libs/nest-core/src/modules/auth/auth.controller.ts'
const accountController = 'libs/nest-core/src/modules/auth/controllers/account.controller.ts'
const authRateLimit = 'libs/nest-core/src/modules/auth/services/auth-rate-limit.service.ts'
const tokenService = 'libs/nest-core/src/modules/auth/services/token.service.ts'
const userService = 'libs/nest-core/src/modules/user/user.service.ts'
const passwordHasher = 'libs/nest-core/src/modules/user/services/password-hasher.service.ts'
const mailerService = 'libs/nest-core/src/shared/mailer/mailer.service.ts'
const migration = 'libs/database/src/migrations/1765200000000-ai-security-quota.ts'

// Authenticated production CORS must never regress to wildcard origin.
forbidPattern(main, /origin\s*:\s*['"]\*['"]/, 'authenticated API CORS must use an exact/controlled origin policy')

// New password writes and active auth flows must be bcrypt-only. Legacy MD5
// verification is isolated inside PasswordHasherService solely for one-time migration.
forbidPattern(legacyAuth, /\bmd5\s*\(/i, 'legacy MD5 password verification must not remain in the active auth service')
forbidPattern(userService, /\bmd5\s*\(/i, 'new or changed passwords must not be written with MD5')
requireText(passwordHasher, "from 'bcrypt'", 'password hashing policy must use bcrypt')
requireText(passwordHasher, 'upgradedHash', 'successful legacy verification must upgrade the stored hash')

// Public auth routes need a distributed limiter; the global in-memory throttle
// alone is insufficient when multiple backend instances are running.
requireText(authController, 'AuthRateLimitService', 'sensitive auth routes must use the distributed auth limiter')
requireText(authRateLimit, "redis.call('INCR'", 'auth limiter must increment atomically in Redis')
requireText(authRateLimit, "createHash('sha256')", 'auth limiter keys must not expose email/token material')
requireText(accountController, "@Post('logout')", 'logout must support a state-changing POST route')
forbidPattern(accountController, /@Get\(['"]logout['"]\)/, 'logout must not remain reachable through state-changing GET')
requireText(tokenService, "createHmac('sha256'", 'refresh tokens must be keyed-hashed before database storage')
requireText(tokenService, "refreshToken.value = this.refreshTokenStorageValue", 'new refresh tokens must not be stored in plaintext')
requireText(mailerService, 'EMAIL_CODE_LIMIT_SCRIPT', 'email verification quotas must be reserved atomically')
requireText(mailerService, "redis.call('INCR', emailDaily)", 'email verification daily quota must increment the key that is checked')

// Public scan entrypoints must remain bounded.
forbidText(controller, '@SkipThrottle()', 'lab scans must never bypass throttling')
requireText(controller, '@Throttle({ default: { limit: 6, ttl: 60_000 } })', 'scan creation rate limit must remain enabled')
requireText(controller, '@Throttle({ default: { limit: 120, ttl: 60_000 } })', 'scan polling rate limit must remain enabled')
requireText(controller, '@RequestTimeoutMs(180_000)', 'scan request timeout must remain bounded')
requireText(controller, "process.env.NODE_ENV !== 'production'", 'local scan allowance must stay disabled in production')
requireText(controller, 'checked.ok === false', 'TypeScript-safe URL-policy narrowing hotfix must remain applied')

// SSRF policy must validate both the parsed URL and resolved addresses.
requireText(policy, 'lookup(url.hostname', 'DNS resolution must be checked before scanning')
requireText(policy, 'URL userinfo is not allowed', 'userinfo parser ambiguity must stay blocked')
requireText(policy, "host.endsWith('.internal')", 'internal hostnames must stay blocked')
requireText(policy, 'isBlockedIp', 'private/reserved resolved addresses must stay blocked')

// Redirects are a second SSRF boundary and must be revalidated hop-by-hop.
requireText(runner, "redirect: 'manual'", 'automatic redirect following must stay disabled')
requireText(runner, 'validateRuntimeUrl(nextUrl)', 'every redirect destination must pass URL policy')
requireText(runner, 'nextCheck.ok === false', 'redirect URL-policy narrowing hotfix must remain applied')
requireText(runner, 'checked.ok === false', 'initial runtime URL-policy narrowing hotfix must remain applied')

// Provider cost controls must remain atomic and cache-aware.
requireText(quota, 'ON CONFLICT (tenant_id, usage_day)', 'daily quota charging must remain database-atomic')
requireText(quota, 'RETURNING used_units', 'quota charge must only succeed when the database accepted it')
requireText(keywords, 'cache hits are free', 'provider quota must only be charged on cache misses')
requireText(migration, 'CHECK ("used_units" >= 0)', 'quota usage must never become negative')

// Observability must correlate requests without logging query strings or auth material.
requireText(observability, "url.split('?')[0]", 'request logs must strip query strings')
requireText(observability, 'traceparent', 'W3C trace correlation must remain available')
forbidText(observability, 'request.headers.authorization', 'authorization headers must not be logged')
forbidText(observability, 'request.headers.cookie', 'cookies must not be logged')
requireText(appModule, 'useClass: RequestObservabilityInterceptor', 'request observability interceptor must remain registered')

const failed = checks.filter(([ok]) => !ok)
for (const [ok, message] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`)
if (failed.length) {
  console.error(`Phase 12 backend hardening failed: ${failed.length} invariant(s) violated.`)
  process.exit(1)
}
console.log('Phase 12 backend hardening passed.')
