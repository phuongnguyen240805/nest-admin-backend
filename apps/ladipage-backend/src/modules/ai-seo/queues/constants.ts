export const AI_SEO_QUEUES = {
  LIGHTHOUSE: 'ai-seo-lighthouse',
} as const

export type LabScanTrigger = 'editor' | 'list' | 'ai_seo' | 'publish'
export type LabScanPhase = 'pre_publish' | 'post_publish'
export type LabScanDepth = 'quick' | 'full'
export type LabScanStatus = 'queued' | 'running' | 'success' | 'failed'
