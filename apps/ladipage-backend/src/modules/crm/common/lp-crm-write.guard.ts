import { ServiceUnavailableException } from '@nestjs/common'

import { isCrmEnabled } from '@liora/crm-core'

/**
 * lp_* CRM tables are read-only when CRM is enabled.
 * Writes go through CrmPersonService / CrmCompanyService via CrmFacade.
 */
export function assertLpCrmWritable(
  entity: 'customer' | 'company' | 'custom_field',
): void {
  if (isCrmEnabled()) {
    throw new ServiceUnavailableException(
      `lp_${entity} is read-only when CRM_ENABLED=true. Use CRM API.`,
    )
  }
}