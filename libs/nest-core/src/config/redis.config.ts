import { ConfigType, registerAs } from '@nestjs/config'

import { buildRedisOptions } from '@liora/database/utils/connection-url.util'
import type { RedisOptions } from 'ioredis'

export const redisRegToken = 'redis'

export const RedisConfig = registerAs(redisRegToken, (): RedisOptions => buildRedisOptions())

export type IRedisConfig = ConfigType<typeof RedisConfig>
