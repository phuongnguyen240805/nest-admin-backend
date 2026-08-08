export interface ShopeeCampaignDraft {
  campaign: {
    name: string
    type: 'PRODUCT' | 'SHOP' | 'SEARCH' | 'DISCOVERY' | 'GMV_MAX'
    budget: number
    targetRoas?: number
    productIds?: string[]
    settings?: Record<string, unknown>
  }
}
