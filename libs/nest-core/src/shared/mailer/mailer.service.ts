import { Inject, Injectable } from '@nestjs/common'

import { MailerService as NestMailerService } from '@nestjs-modules/mailer'
import dayjs from 'dayjs'

import Redis from 'ioredis'

import { InjectRedis } from '~/common/decorators/inject-redis.decorator'
import { BusinessException } from '~/common/exceptions/biz.exception'
import { AppConfig, IAppConfig } from '~/config'
import { ErrorEnum } from '~/constants/error-code.constant'
import { randomValue } from '~/utils'

const EMAIL_CODE_LIMIT_SCRIPT = `
local ipBurst = KEYS[1]
local emailBurst = KEYS[2]
local emailDaily = KEYS[3]
local ipDaily = KEYS[4]
local dailyLimit = tonumber(ARGV[1])
local dailyTtl = tonumber(ARGV[2])

if redis.call('EXISTS', ipBurst) == 1 or redis.call('EXISTS', emailBurst) == 1 then
  return 0
end

local emailCount = tonumber(redis.call('GET', emailDaily) or '0')
local ipCount = tonumber(redis.call('GET', ipDaily) or '0')
if emailCount >= dailyLimit or ipCount >= dailyLimit then
  return -1
end

redis.call('SET', ipBurst, '1', 'EX', 60)
redis.call('SET', emailBurst, '1', 'EX', 60)
local nextEmail = redis.call('INCR', emailDaily)
if nextEmail == 1 then redis.call('EXPIRE', emailDaily, dailyTtl) end
local nextIp = redis.call('INCR', ipDaily)
if nextIp == 1 then redis.call('EXPIRE', ipDaily, dailyTtl) end
return 1
`

@Injectable()
export class MailerService {
  constructor(
    @Inject(AppConfig.KEY) private appConfig: IAppConfig,
    @InjectRedis() private redis: Redis,
    private mailerService: NestMailerService,
  ) {}

  async log(to: string, code: string, ip: string) {
    await this.redis.set(`captcha:${to}`, code, 'EX', 60 * 5)
  }

  async checkCode(to, code) {
    const ret = await this.redis.get(`captcha:${to}`)
    if (ret !== code)
      throw new BusinessException(ErrorEnum.INVALID_VERIFICATION_CODE)

    await this.redis.del(`captcha:${to}`)
  }

  async checkLimit(to, ip) {
    const LIMIT_TIME = 5
    const now = dayjs()
    const dailyTtl = Math.max(60, now.endOf('day').diff(now, 'second'))
    const result = Number(await this.redis.eval(
      EMAIL_CODE_LIMIT_SCRIPT,
      4,
      `ip:${ip}:send:limit`,
      `captcha:${to}:limit`,
      `captcha:${to}:limit-day`,
      `ip:${ip}:send:limit-day`,
      String(LIMIT_TIME),
      String(dailyTtl),
    ))

    if (result === 0) {
      throw new BusinessException(ErrorEnum.TOO_MANY_REQUESTS)
    }

    if (result === -1) {
      throw new BusinessException(
        ErrorEnum.MAXIMUM_FIVE_VERIFICATION_CODES_PER_DAY,
      )
    }

    if (result !== 1) {
      // Fail closed if Redis returns an unexpected script result.
      throw new BusinessException(ErrorEnum.TOO_MANY_REQUESTS)
    }
  }

  async send(
    to,
    subject,
    content: string,
    type: 'text' | 'html' = 'text',
  ): Promise<any> {
    if (type === 'text') {
      return this.mailerService.sendMail({
        to,
        subject,
        text: content,
      })
    }
    else {
      return this.mailerService.sendMail({
        to,
        subject,
        html: content,
      })
    }
  }

  async sendVerificationCode(to, code = randomValue(4, '1234567890')) {
    const subject = `[${this.appConfig.name}] 验证码`

    try {
      await this.mailerService.sendMail({
        to,
        subject,
        template: './verification-code-zh',
        context: {
          code,
        },
      })
    }
    catch (error) {
      console.log(error)
      throw new BusinessException(ErrorEnum.VERIFICATION_CODE_SEND_FAILED)
    }

    return {
      to,
      code,
    }
  }

//   async sendUserConfirmation(user: UserEntity, token: string) {
//     const url = `example.com/auth/confirm?token=${token}`
//     await this.mailerService.sendMail({
//       to: user.email,
//       subject: 'Confirm your Email',
//       template: './confirmation',
//       context: {
//         name: user.name,
//         url,
//       },
//     })
//   }
}
