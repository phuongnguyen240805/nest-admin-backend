import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'

import type { PlanTier } from '@liora/api-types'
import { LandingPagesQuotaPort, PlanConfigService, TenantContextService } from '@liora/nest-core'
import { SubscriptionService } from '@liora/nest-core/modules/billing/services/subscription.service'
import { SupabaseService } from '@liora/supabase'

type ReservationBucket = {
  jobIds: Set<string>
}

@Injectable()
export class LandingPageQuotaService implements LandingPagesQuotaPort {
  private readonly logger = new Logger(LandingPageQuotaService.name)
  private readonly reservations = new Map<string, ReservationBucket>()

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly subscriptionService: SubscriptionService,
    private readonly planConfigService: PlanConfigService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async countPagesForOrganization(organizationId: string): Promise<number> {
    if (!this.supabaseService.hasAdminClient()) {
      this.logger.warn(
        'Supabase admin unavailable — landing page count returns 0',
      )
      return 0
    }

    const client = this.supabaseService.getAdminClient()

    const { count: websiteCount, error: websiteError } = await client
      .from('website_pages')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('page_type', 'landing_page')

    if (!websiteError && websiteCount != null) {
      return websiteCount
    }

    if (websiteError) {
      this.logger.warn(
        `website_pages count failed (${websiteError.message}) — falling back to landing_pages`,
      )
    }

    const { data: members, error: membersError } = await client
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organizationId)

    if (membersError) {
      this.logger.warn(`organization_members lookup failed: ${membersError.message}`)
      return 0
    }

    const userIds = (members ?? [])
      .map((row) => row.user_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)

    if (userIds.length === 0) {
      return 0
    }

    const { count, error } = await client
      .from('landing_pages')
      .select('id', { count: 'exact', head: true })
      .in('user_id', userIds)

    if (error) {
      this.logger.warn(`landing_pages count failed: ${error.message}`)
      return 0
    }

    return count ?? 0
  }

  private getReservedCount(organizationId: string): number {
    return this.reservations.get(organizationId)?.jobIds.size ?? 0
  }

  reserveSlot(organizationId: string, jobId: string): void {
    const bucket = this.reservations.get(organizationId) ?? { jobIds: new Set<string>() }
    bucket.jobIds.add(jobId)
    this.reservations.set(organizationId, bucket)
  }

  releaseSlot(organizationId: string, jobId: string): void {
    const bucket = this.reservations.get(organizationId)
    if (!bucket) return
    bucket.jobIds.delete(jobId)
    if (bucket.jobIds.size === 0) {
      this.reservations.delete(organizationId)
    }
    else {
      this.reservations.set(organizationId, bucket)
    }
  }

  isUnlimited(limit: number): boolean {
    return limit < 0
  }

  async getQuotaSnapshot(organizationId: string): Promise<{
    used: number
    reserved: number
    limit: number
    tier: PlanTier
  }> {
    const subscription = await this.subscriptionService.getOrCreateSubscription(organizationId)
    const tier = subscription.subscriptionTier as PlanTier
    const limit = this.planConfigService.getLimitsForTier(tier).pages
    const used = await this.countPagesForOrganization(organizationId)
    const reserved = this.getReservedCount(organizationId)

    return { used, reserved, limit, tier }
  }

  async assertCanCreatePage(organizationId: string, jobId: string): Promise<void> {
    const { used, reserved, limit } = await this.getQuotaSnapshot(organizationId)

    if (this.isUnlimited(limit)) {
      this.reserveSlot(organizationId, jobId)
      return
    }

    if (used + reserved >= limit) {
      throw new HttpException(
        {
          upgrade: true,
          message: `Landing page quota exceeded (${used}/${limit}). Upgrade your plan to create more pages.`,
          pages: { used, limit },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    this.reserveSlot(organizationId, jobId)
  }
}