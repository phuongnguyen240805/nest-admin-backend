import type { AiToolDefinition } from '@liora/ai-gateway'

export interface CustomerCareAiToolContext {
  tenantId: number
  conversationId: string
  actorUserId: number
  jobId?: string
}

export interface CustomerCareAiTool {
  readonly name: string
  definition(): AiToolDefinition
  execute(args: Record<string, unknown>, context: CustomerCareAiToolContext): Promise<unknown>
}
