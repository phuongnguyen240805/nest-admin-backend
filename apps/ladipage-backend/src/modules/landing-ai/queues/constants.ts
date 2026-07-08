export const LANDING_AI_QUEUES = {
  GENERATE: 'landing-ai-generate',
  UPDATE: 'landing-ai-update',
} as const

export type LandingAiJobType = 'ai' | 'clone' | 'ppc' | 'update'

export type LandingAiJobStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'