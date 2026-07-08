export interface LandingPagesQuotaPort {
  countPagesForOrganization(organizationId: string): Promise<number>
}

export const LANDING_PAGES_QUOTA = Symbol('LANDING_PAGES_QUOTA')