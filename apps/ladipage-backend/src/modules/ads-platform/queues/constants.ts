export const ADS_PLATFORM_QUEUES = {
  OPERATIONS: 'ads-platform-operations',
} as const

export type AdsQueuePayload = { jobId: string }
