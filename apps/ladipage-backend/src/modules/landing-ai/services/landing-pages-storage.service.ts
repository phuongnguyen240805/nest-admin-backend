import { Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from '@liora/supabase'

import type { EditorDataShape } from '../converters/html-to-editor.converter'

const OPTIONAL_AI_COLUMNS = ['ai_source_html', 'generation_meta'] as const

function isMissingOptionalAiColumnError(message: string): boolean {
  const normalized = message.toLowerCase()
  return OPTIONAL_AI_COLUMNS.some((column) => (
    normalized.includes(column)
    && normalized.includes('column')
    && normalized.includes('landing_pages')
  ))
}

function isDuplicateUserSlugError(message: string): boolean {
  return message.toLowerCase().includes('landing_pages_user_slug_unique')
}

@Injectable()
export class LandingPagesStorageService {
  private readonly logger = new Logger(LandingPagesStorageService.name)

  constructor(private readonly supabaseService: SupabaseService) {}

  async upsertLandingPage(input: {
    pageId: string
    name: string
    slug: string
    /** Supabase auth.users UUID; null/omit when Nest user has no Supabase link */
    supabaseUserId?: string | null
    editorData: EditorDataShape
    tagIds?: string[]
    aiSourceHtml?: string
    generationMeta?: Record<string, unknown>
  }): Promise<{ slug: string }> {
    if (!this.supabaseService.hasAdminClient()) {
      throw new Error(
        'Supabase admin client unavailable — cannot persist AI landing page to landing_pages',
      )
    }

    if (!input.supabaseUserId) {
      throw new Error(
        'supabaseUserId is required — cannot persist AI landing page without an owner',
      )
    }

    const client = this.supabaseService.getAdminClient()
    const now = new Date().toISOString()
    let resolvedSlug = await this.resolveUniqueSlug(
      client,
      input.supabaseUserId,
      input.slug,
      input.pageId,
    )

    const row: Record<string, unknown> = {
      id: input.pageId,
      name: input.name,
      slug: resolvedSlug,
      status: 'draft',
      visibility: 'private',
      user_id: input.supabaseUserId,
      editor_data: input.editorData,
      updated_at: now,
      created_at: now,
    }

    if (input.aiSourceHtml) {
      row.ai_source_html = input.aiSourceHtml
    }
    if (input.generationMeta) {
      row.generation_meta = input.generationMeta
    }

    const { error } = await client.from('landing_pages').upsert(row, { onConflict: 'id' })

    if (error) {
      if (isMissingOptionalAiColumnError(error.message)) {
        const fallbackRow = { ...row }
        delete fallbackRow.ai_source_html
        delete fallbackRow.generation_meta

        this.logger.warn(
          `Retrying landing_pages upsert without optional AI metadata columns for page ${input.pageId}: ${error.message}`,
        )

        const { error: fallbackError } = await client
          .from('landing_pages')
          .upsert(fallbackRow, { onConflict: 'id' })

        if (fallbackError) {
          throw new Error(`Failed to upsert landing_pages: ${fallbackError.message}`)
        }
      }
      else if (isDuplicateUserSlugError(error.message)) {
        const retrySlug = await this.resolveUniqueSlug(
          client,
          input.supabaseUserId,
          `${input.slug}-${input.pageId.slice(0, 8)}`,
          input.pageId,
        )
        const retryRow = { ...row, slug: retrySlug }
        const { error: retryError } = await client
          .from('landing_pages')
          .upsert(retryRow, { onConflict: 'id' })

        if (retryError) {
          throw new Error(`Failed to upsert landing_pages: ${retryError.message}`)
        }

        resolvedSlug = retrySlug
      }
      else {
        throw new Error(`Failed to upsert landing_pages: ${error.message}`)
      }
    }

    if (input.tagIds?.length) {
      await client.from('landing_page_tags').delete().eq('page_id', input.pageId)

      const { error: tagError } = await client.from('landing_page_tags').insert(
        input.tagIds.map((tagId) => ({
          page_id: input.pageId,
          tag_id: tagId,
        })),
      )

      if (tagError) {
        throw new Error(`Failed to assign landing page tags: ${tagError.message}`)
      }
    }

    return { slug: resolvedSlug }
  }

  private async resolveUniqueSlug(
    client: ReturnType<SupabaseService['getAdminClient']>,
    userId: string,
    preferredSlug: string,
    pageId: string,
  ): Promise<string> {
    const base = preferredSlug.trim() || `page-${pageId.slice(0, 8)}`

    const isAvailable = async (slug: string): Promise<boolean> => {
      const { data, error } = await client
        .from('landing_pages')
        .select('id')
        .eq('user_id', userId)
        .eq('slug', slug)
        .maybeSingle()

      if (error) {
        throw new Error(`Failed to resolve landing page slug: ${error.message}`)
      }

      return !data || data.id === pageId
    }

    if (await isAvailable(base)) {
      return base
    }

    for (let suffix = 2; suffix <= 99; suffix += 1) {
      const candidate = `${base}-${suffix}`
      if (await isAvailable(candidate)) {
        return candidate
      }
    }

    return `${base}-${pageId.slice(0, 8)}`
  }
}
