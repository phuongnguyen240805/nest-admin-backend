import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { FastifyRequest } from 'fastify'
import Redis from 'ioredis'

import { InjectRedis } from '~/common/decorators/inject-redis.decorator'
import { BusinessException } from '~/common/exceptions/biz.exception'
import { getIp } from '~/utils/ip.util'

/**
 * Guard to prevent spam registration.
 * Validates email domains (whitelist & blocklist) and applies rate limiting per IP and email.
 */
@Injectable()
export class AntiSpamRegisterGuard implements CanActivate {
  private readonly logger = new Logger(AntiSpamRegisterGuard.name)

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Determine if the registration request can proceed.
   * Runs anti-spam checks (email validation, whitelist, blocklist, and IP/email rate limiting).
   * 
   * @param context ExecutionContext
   * @returns Promise<boolean>
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const body = request.body as any

    if (!body) {
      return true
    }

    const useSupabase = this.configService.get<boolean>('supabase.useSupabaseAuth') ?? false
    const email = body.email

    // Backward compatibility check
    if (!email) {
      if (useSupabase) {
        throw new BusinessException('1204:Email là thông tin bắt buộc khi đăng ký.')
      }
      // Supabase is disabled and email is not provided, bypass spam checks
      return true
    }

    // 1. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new BusinessException('1205:Định dạng email không chính xác')
    }

    const domain = email.split('@')[1].toLowerCase()

    // 2. Email Domain Whitelist Check
    const allowedDomainsStr = this.configService.get<string>('supabase.allowedDomains') || 'gmail.com'
    const allowedDomains = allowedDomainsStr.split(',').map(d => d.trim().toLowerCase())

    if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
      throw new BusinessException(`1206:Tên miền email này không được phép. Chỉ chấp nhận: ${allowedDomains.join(', ')}`)
    }

    // 3. Email Domain Blocklist Check (Temporary Mail check)
    const blockedDomainsStr = this.configService.get<string>('supabase.blockedDomains') || ''
    const blockedDomains = blockedDomainsStr.split(',').map(d => d.trim().toLowerCase())

    if (blockedDomains.includes(domain)) {
      throw new BusinessException('1207:Việc đăng ký bằng địa chỉ email tạm thời bị nghiêm cấm.')
    }

    const disableRateLimit = this.configService.get<boolean>('supabase.disableRegistrationRateLimit') ?? false
    if (disableRateLimit) {
      return true
    }

    // 4. Rate Limiting per IP & Email
    const ip = getIp(request) || 'unknown-ip'

    const ipLimitCount = this.configService.get<number>('supabase.limitIpCount') ?? 3
    const ipLimitWindow = this.configService.get<number>('supabase.limitIpWindow') ?? 600 // 10 minutes

    const emailLimitCount = this.configService.get<number>('supabase.limitEmailCount') ?? 2
    const emailLimitWindow = this.configService.get<number>('supabase.limitEmailWindow') ?? 86400 // 24 hours

    const ipKey = `liora:auth:register:ip:${ip}`
    const emailKey = `liora:auth:register:email:${email}`

    // Check IP rate limit
    if (ip !== 'unknown-ip') {
      const ipRequestCount = await this.redis.get(ipKey)
      if (ipRequestCount && parseInt(ipRequestCount, 10) >= ipLimitCount) {
        this.logger.warn(`IP Rate limit hit for IP: ${ip}`)
        throw new BusinessException('1201:Địa chỉ IP này đang thực hiện quá nhiều yêu cầu đăng ký, vui lòng thử lại sau.')
      }
    }

    // Check Email rate limit
    const emailRequestCount = await this.redis.get(emailKey)
    if (emailRequestCount && parseInt(emailRequestCount, 10) >= emailLimitCount) {
      this.logger.warn(`Email Rate limit hit for email: ${email}`)
      throw new BusinessException('1208:Yêu cầu đăng ký email này xuất hiện quá thường xuyên, vui lòng thử lại sau.')
    }

    // Increment IP rate limit
    if (ip !== 'unknown-ip') {
      const currentIpVal = await this.redis.incr(ipKey)
      if (currentIpVal === 1) {
        await this.redis.expire(ipKey, ipLimitWindow)
      }
    }

    // Increment Email rate limit
    const currentEmailVal = await this.redis.incr(emailKey)
    if (currentEmailVal === 1) {
      await this.redis.expire(emailKey, emailLimitWindow)
    }

    return true
  }
}
