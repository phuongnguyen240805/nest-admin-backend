export interface TikTokCampaignDraft {
  campaign: {
    campaignName: string
    objectiveType: string
    budgetMode?: string
    budget?: number
  }
  adGroup: {
    adgroupName: string
    placementType: string
    promotionType: string
    optimizationGoal: string
    budgetMode: string
    budget: number
    scheduleType: string
    scheduleStartTime?: string
    scheduleEndTime?: string
    targeting: Record<string, unknown>
    pixelId?: string
  }
  ad: {
    adName: string
    identityType?: string
    identityId?: string
    creatives: Array<Record<string, unknown>>
  }
}

export interface TikTokResponse<T> {
  code: number
  message: string
  request_id?: string
  data: T
}
