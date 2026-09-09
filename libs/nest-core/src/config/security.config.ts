import { ConfigType, registerAs } from '@nestjs/config'

import { env, envNumber } from '~/global/env'

export const securityRegToken = 'security'

export const SecurityConfig = registerAs(securityRegToken, () => ({
  jwtSecret: env('JWT_SECRET'),
  // Preserve the lifetimes already documented in the root .env.example even
  // when deployments only provide the agreed secret/key contract.
  jwtExprire: envNumber('JWT_EXPIRE', 86_400),
  refreshSecret: env('REFRESH_TOKEN_SECRET'),
  refreshExpire: envNumber('REFRESH_TOKEN_EXPIRE', 2_592_000),
}))

export type ISecurityConfig = ConfigType<typeof SecurityConfig>
