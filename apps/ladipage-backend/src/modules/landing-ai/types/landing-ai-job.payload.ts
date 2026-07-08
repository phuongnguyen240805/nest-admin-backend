import type { CreateLandingAiJobDto } from '../dto/create-landing-ai-job.dto'

export interface LandingAiGeneratePayload {
  jobId: string
  tenantId: number
  organizationId: string
  /** Nest sys_user.id as string — quota, job store */
  userId: string
  /** Supabase auth.users UUID for landing_pages.user_id; null when unlinked */
  supabaseUserId?: string | null
  pageId: string
  type: CreateLandingAiJobDto['type']
  name: string
  tagIds?: string[]
  importMode?: 'preserve' | 'convert'
  params: CreateLandingAiJobDto['params']
}