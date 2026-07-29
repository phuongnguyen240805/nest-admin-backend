import { ForbiddenException, Injectable } from '@nestjs/common'

import { getCloudPhoneConfig } from '../cloud-phone.config'

/**
 * Feature/permission gate for Cloud Phone.
 * assertEnabled mirrors commerce: block when the feature master switch is off.
 * Permission checks are soft (allow when token carries no permission list) so
 * legacy tokens keep working; when a list is present the required key is enforced.
 */
@Injectable()
export class CloudPhoneAccessService {
  assertEnabled(): void {
    const cfg = getCloudPhoneConfig()
    if (!cfg.enabled) {
      throw new ForbiddenException('Cloud Phone is disabled (CLOUDPHONE_ENABLED=false)')
    }
  }

  isMockMode(): boolean {
    return getCloudPhoneConfig().mockMode
  }

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
