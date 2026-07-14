export type AiCapability = 'text' | 'image' | 'image_edit' | 'video' | 'embedding'

export interface AiGatewayRequestBase {
  workspaceId: string
  invocationId: string
  idempotencyKey?: string
  sessionId?: string
  capability: AiCapability
  modelHint?: string
  routingHint?: 'quality' | 'speed' | 'cost' | 'balanced'
  timeoutMs?: number
  metadata?: {
    pageId?: string
    toolName?: string
    source?: 'mcp' | 'admin' | 'worker'
  }
}

export interface AiTextRequest extends AiGatewayRequestBase {
  capability: 'text'
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  responseFormat?: 'text' | 'json'
  temperature?: number
  maxTokens?: number
}

export interface AiTextResult {
  text: string
  json?: unknown
  usage: AiUsage
  trace: AiProviderTrace
  warnings: string[]
}

export interface AiImageRequest extends AiGatewayRequestBase {
  capability: 'image'
  prompt: string
  size?: '1024x1024' | '1024x1536' | '1536x1024'
  count?: number
  styleHint?: string
}

export interface AiImageEditRequest extends AiGatewayRequestBase {
  capability: 'image_edit'
  prompt: string
  sourceAssetIds: string[]
  maskAssetId?: string
}

export interface AiImageResult {
  assets: Array<{
    temporaryUrl?: string
    assetId?: string
    mimeType?: string
    width?: number
    height?: number
  }>
  usage: AiUsage
  trace: AiProviderTrace
  warnings: string[]
}

export interface AiVideoRequest extends AiGatewayRequestBase {
  capability: 'video'
  prompt: string
  imageAssetId?: string
  durationSeconds?: number
}

export interface AiVideoResult {
  jobId?: string
  temporaryUrl?: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  usage: AiUsage
  trace: AiProviderTrace
  warnings: string[]
}

export interface AiListModelsRequest {
  capability?: AiCapability
}

export interface AiModel {
  id: string
  provider?: string
  capabilities?: AiCapability[]
}

export interface AiUsage {
  inputTokens?: number
  outputTokens?: number
  estimatedCost?: number
  currency?: string
}

export interface AiProviderTrace {
  gateway: 'fake' | 'omniroute'
  requestId?: string
  provider?: string
  model?: string
  latencyMs?: number
  fallbackAttempts?: number
  rawHeaders?: Record<string, string>
}

export interface AiGatewayHealth {
  ok: boolean
  gateway: 'fake' | 'omniroute'
  latencyMs?: number
  availableCapabilities: AiCapability[]
  errorCode?: string
}

export interface AiProviderGateway {
  generateText(request: AiTextRequest): Promise<AiTextResult>
  generateImage(request: AiImageRequest): Promise<AiImageResult>
  editImage(request: AiImageEditRequest): Promise<AiImageResult>
  generateVideo(request: AiVideoRequest): Promise<AiVideoResult>
  listModels(request?: AiListModelsRequest): Promise<AiModel[]>
  healthCheck(): Promise<AiGatewayHealth>
}
