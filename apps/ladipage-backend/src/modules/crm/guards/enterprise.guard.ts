import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'

import { isEnterpriseTierAllowed } from '@liora/crm-core'
import { BillingService } from '@liora/nest-core/modules/billing/services/billing.service'
import { Organization } from '@liora/nest-core/modules/billing/entities/organization.entity'

/** Blocks Enterprise-only CRM routes (custom objects) for non-Enterprise tiers. */
@Injectable()
export class EnterpriseGuard implements CanActivate {
  constructor(private readonly billingService: BillingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ org?: Organization }>()
    const org = request.org

    if (!org) {
      throw new ForbiddenException('Workspace context is required')
    }

    const billing = await this.billingService.getCurrentBilling(org)
    const tier = billing?.subscriptionTier ?? 'free'

    if (!isEnterpriseTierAllowed(tier)) {
      throw new ForbiddenException(
        'CRM custom objects require Enterprise or Lifetime plan',
      )
    }

    return true
  }
}