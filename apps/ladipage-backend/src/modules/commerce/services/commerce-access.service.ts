import { ForbiddenException, Injectable } from '@nestjs/common'

import { getCommerceConfig } from '../commerce.config'

/**
 * M0: monetize off; permission checks soft when no permission list on request.
 * Controllers may pass explicit permission flags later from RBAC.
 */
@Injectable()
export class CommerceAccessService {
  assertEnabled(): void {
    const cfg = getCommerceConfig()
    if (!cfg.enabled) {
      throw new ForbiddenException('Commerce Medusa is disabled (COMMERCE_MEDUSA_ENABLED=false)')
    }
  }

  isMonetizeEnabled(): boolean {
    return getCommerceConfig().monetize
  }

  isMockMode(): boolean {
    return getCommerceConfig().mockMode
  }

  /**
   * Soft check — when permissions array empty (legacy tokens), allow.
   * When provided, require the given key.
   */
  assertPermission(permissions: string[] | undefined, required: string): void {
    if (!permissions || permissions.length === 0) return
    if (
      permissions.includes('*')
      || permissions.includes('admin')
      || permissions.includes(required)
    ) {
      return
    }
    throw new ForbiddenException(`Missing permission ${required}`)
  }
}
