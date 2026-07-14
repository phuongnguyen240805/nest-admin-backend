import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'

import { CreateLandingAiJobDto } from '../landing-ai/dto/create-landing-ai-job.dto'
import { LandingAiService } from '../landing-ai/services/landing-ai.service'
import { ApiKeyService, type ValidatedApiKeyContext } from '../settings/api-key.service'
import type { McpApiKeyScope } from '../settings/dto/api-key.dto'

interface McpToolDefinition {
  name: string
  description: string
  requiredScopes: McpApiKeyScope[]
  inputSchema: Record<string, unknown>
}

const TOOLS: McpToolDefinition[] = [
  {
    name: 'ladipage_workspace_get',
    description: 'Return workspace context attached to the API key.',
    requiredScopes: ['workspace:read'],
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'landingpage_create_draft',
    description: 'Create an asynchronous AI landing page draft job.',
    requiredScopes: ['landing:create', 'asset:generate'],
    inputSchema: {
      type: 'object',
      required: ['name', 'prompt'],
      properties: {
        name: { type: 'string' },
        prompt: { type: 'string' },
        businessName: { type: 'string' },
        industry: { type: 'string' },
        location: { type: 'string' },
        goal: { type: 'string' },
        style: { type: 'string' },
        offer: { type: 'string' },
        cta: { type: 'string' },
        tagIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
      },
    },
  },
  {
    name: 'landingpage_get',
    description: 'Return an AI landing page job by jobId.',
    requiredScopes: ['landing:read'],
    inputSchema: {
      type: 'object',
      required: ['jobId'],
      properties: {
        jobId: { type: 'string' },
      },
    },
  },
]

@Injectable()
export class McpLandingService {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly landingAiService: LandingAiService,
  ) {}

  listTools(auth: ValidatedApiKeyContext) {
    return {
      tools: TOOLS
        .filter((tool) => this.apiKeyService.hasScopes(auth.scopes, tool.requiredScopes))
        .map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
    }
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
    auth: ValidatedApiKeyContext,
  ): Promise<unknown> {
    const tool = TOOLS.find((candidate) => candidate.name === name)
    if (!tool) {
      throw new NotFoundException(`MCP tool "${name}" is not registered`)
    }
    if (!this.apiKeyService.hasScopes(auth.scopes, tool.requiredScopes)) {
      throw new ForbiddenException(`API key does not have required scopes for ${name}`)
    }

    if (name === 'ladipage_workspace_get') {
      return {
        tenantId: auth.tenantId,
        organizationId: auth.organizationId,
        apiKeyId: auth.apiKeyId,
        scopes: auth.scopes,
      }
    }

    if (name === 'landingpage_create_draft') {
      return this.createDraft(args, auth)
    }

    if (name === 'landingpage_get') {
      const jobId = this.requiredString(args.jobId, 'jobId')
      return this.landingAiService.getJob(jobId, this.ownerUid(auth))
    }

    throw new NotFoundException(`MCP tool "${name}" is not implemented`)
  }

  private createDraft(args: Record<string, unknown>, auth: ValidatedApiKeyContext) {
    const dto: CreateLandingAiJobDto = {
      type: 'ai',
      name: this.requiredString(args.name, 'name'),
      tagIds: Array.isArray(args.tagIds)
        ? args.tagIds.filter((value): value is string => typeof value === 'string')
        : undefined,
      importMode: 'preserve',
      params: {
        businessName: this.optionalString(args.businessName),
        industry: this.optionalString(args.industry),
        location: this.optionalString(args.location),
        goal: this.optionalString(args.goal),
        style: this.optionalString(args.style),
        prompt: this.requiredString(args.prompt, 'prompt'),
        offer: this.optionalString(args.offer),
        cta: this.optionalString(args.cta),
      },
    }

    return this.landingAiService.createJob(dto, this.ownerUid(auth))
  }

  private ownerUid(auth: ValidatedApiKeyContext): number {
    const parsed = Number(auth.ownerId)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new ForbiddenException('API key owner is not a valid user id')
    }
    return parsed
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new ForbiddenException(`MCP argument "${field}" is required`)
    }
    return value.trim()
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }
}
