import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'

import { isCrmEnabled } from '@liora/crm-core'

/** Blocks CRM-only routes when CRM_ENABLED=false. */
@Injectable()
export class CrmEnabledGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (!isCrmEnabled()) {
      throw new ServiceUnavailableException(
        'CRM is not enabled. Set CRM_ENABLED=true.',
      )
    }
    return true
  }
}