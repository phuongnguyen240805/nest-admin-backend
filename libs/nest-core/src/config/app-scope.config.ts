import { ConfigType, registerAs } from '@nestjs/config'

import { env, envBoolean } from '~/global/env'
import { LEGACY_DEFAULT_APP_CODE } from '~/modules/tenant/constants/app-scope.constant'

export const appScopeRegToken = 'appScope'

export const AppScopeConfig = registerAs(appScopeRegToken, () => ({
  /** Application code for the running backend process (ladipage, nest-admin, …) */
  appCode: env('APP_CODE', LEGACY_DEFAULT_APP_CODE),
  /**
   * When true: workspace resolved via sys_user_app_membership per APP_CODE.
   * When false: legacy sys_user.organizationId + lazy membership sync (safe rollout).
   */
  scopedAuthEnabled: envBoolean('APP_SCOPED_AUTH', false),
  /** Claim fallback for JWT tokens issued before appCode existed */
  legacyAppCode: env('LEGACY_APP_CODE', LEGACY_DEFAULT_APP_CODE),
}))

export type IAppScopeConfig = ConfigType<typeof AppScopeConfig>