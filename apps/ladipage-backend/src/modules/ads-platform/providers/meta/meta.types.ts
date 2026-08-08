export interface MetaCampaignDraft {
  campaign: {
    name: string
    objective: string
    specialAdCategories?: string[]
  }
  adSet: {
    name: string
    dailyBudget?: number
    lifetimeBudget?: number
    billingEvent: string
    optimizationGoal: string
    bidStrategy?: string
    targeting: Record<string, unknown>
    startTime?: string
    endTime?: string
    promotedObject?: Record<string, unknown>
  }
  creative: {
    name: string
    objectStorySpec?: Record<string, unknown>
    objectStoryId?: string
  }
  ad: {
    name: string
  }
}

export interface MetaGraphIdResponse {
  id: string
}

export interface MetaGraphPage<T> {
  data: T[]
  paging?: { cursors?: { after?: string }; next?: string }
}
