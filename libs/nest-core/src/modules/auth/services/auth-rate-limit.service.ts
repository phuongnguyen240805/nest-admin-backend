import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { createHash } from 'node:crypto'
import Redis from 'ioredis'

import { InjectRedis } from '~/common/decorators/inject-redis.decorator'

interface RateRule {
  limit: number
  windowSeconds: number
}

const RULES = {
  loginIp: { limit: 20, windowSeconds: 15 * 60 },
  loginIdentity: { limit: 8, windowSeconds: 15 * 60 },
  exchangeIp: { limit: 30, windowSeconds: 15 * 60 },
  googleIp: { limit: 20, windowSeconds: 15 * 60 },
  refreshIp: { limit: 120, windowSeconds: 5 * 60 },
  registerIp: { limit: 10, windowSeconds: 60 * 60 },
  registerIdentity: { limit: 5, windowSeconds: 60 * 60 },
} satisfies Record<string, RateRule>

const INCREMENT_WITH_TTL = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return { current, ttl }
`

/** Distributed auth limiter. Keys are hashed so emails/tokens never become Redis key material. */
@Injectable()
export class AuthRateLimitService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  assertLoginIpAllowed(ip: string): Promise<void> {
    return this.consume('login-ip', ip, RULES.loginIp)
  }

  assertLoginIdentityAllowed(email: string): Promise<void> {
    return this.consume('login-identity', email.trim().toLowerCase(), RULES.loginIdentity)
  }

  assertExchangeAllowed(ip: string): Promise<void> {
    return this.consume('exchange-ip', ip, RULES.exchangeIp)
  }

  assertGoogleAllowed(ip: string): Promise<void> {
    return this.consume('google-ip', ip, RULES.googleIp)
  }

  assertRefreshAllowed(ip: string): Promise<void> {
    return this.consume('refresh-ip', ip, RULES.refreshIp)
  }

  async assertRegisterAllowed(ip: string, email: string): Promise<void> {
    await Promise.all([
      this.consume('register-ip', ip, RULES.registerIp),
      this.consume('register-identity', email.trim().toLowerCase(), RULES.registerIdentity),
    ])
  }

  private async consume(scope: string, identifier: string, rule: RateRule): Promise<void> {
    const normalized = identifier || 'unknown'
    const digest = createHash('sha256').update(normalized).digest('hex').slice(0, 32)
    const key = `auth:rate:${scope}:${digest}`
    const result = await this.redis.eval(
      INCREMENT_WITH_TTL,
      1,
      key,
      String(rule.windowSeconds),
    ) as [number | string, number | string]

    const count = Number(result[0])
    const retryAfter = Math.max(1, Number(result[1]) || rule.windowSeconds)
    if (count <= rule.limit)
      return

    throw new HttpException(
      { message: 'Too many authentication attempts', retryAfter },
      HttpStatus.TOO_MANY_REQUESTS,
    )
  }
}
