import { ForbiddenException, Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from '@liora/supabase'

import type { LandingEngine, PageRef } from '../ports/landing-page.port'

export interface RegistryRecord {
  pageId: string
  slug: string
  name: string
  engine: LandingEngine
  externalSiteId: string | null
  externalPageId: string | null
  ownerUserId: number | null
  externalWorkspaceId?: string | null
}

export interface RegistryImportSource {
  pageId: string
  name: string
  slug: string
  html: string | null
}

interface RegistryPageRow {
  id: string
  name?: string | null
  slug?: string | null
  render_engine?: string | null
  external_site_id?: string | null
  external_page_id?: string | null
  external_owner_user_id?: string | number | null
  external_workspace_id?: string | null
  published_html?: string | null
  editor_data?: unknown
  ai_source_html?: string | null
  published_meta?: unknown
  publish_version?: number | null
}

/**
 * Ladipage page ↔ Instatic mapping.
 *
 * - Always keeps mapping in memory (works before DB migration).
 * - Reads core page fields from Supabase without requiring external_* columns.
 * - Writes external_* only when columns exist; otherwise memory is source of truth.
 */
@Injectable()
export class PageRegistryStore {
  private readonly logger = new Logger(PageRegistryStore.name)
  private readonly memory = new Map<string, RegistryRecord>()
  private externalColumnsAvailable: boolean | null = null

  constructor(private readonly supabaseService: SupabaseService) {}

  hasPersistentStore(): boolean {
    return this.supabaseService.hasAdminClient()
  }

  async get(pageId: string): Promise<RegistryRecord | null> {
    const mem = this.memory.get(pageId) ?? null

    if (!this.supabaseService.hasAdminClient()) {
      return mem
    }

    try {
      const client = this.supabaseService.getAdminClient()
      const preferredColumns = [
        'id',
        'name',
        'slug',
        'render_engine',
        'external_site_id',
        'external_page_id',
        'external_owner_user_id',
        'external_workspace_id',
      ].join(', ')
      const fallbackColumns = 'id, name, slug, render_engine'

      let result = await client
        .from('landing_pages')
        .select(this.externalColumnsAvailable === false ? fallbackColumns : preferredColumns)
        .eq('id', pageId)
        .maybeSingle()

      if (result.error && this.isOptionalMappingColumnError(result.error.message)) {
        this.externalColumnsAvailable = false
        result = await client
          .from('landing_pages')
          .select(fallbackColumns)
          .eq('id', pageId)
          .maybeSingle()
      }

      const { error } = result
      const data = result.data as unknown as RegistryPageRow | null

      if (error || !data) {
        return mem
      }

      const engine: LandingEngine =
        data.render_engine === 'instatic' || mem?.engine === 'instatic'
          ? 'instatic'
          : 'legacy'

      const record: RegistryRecord = {
        pageId: data.id,
        name: data.name ?? pageId,
        slug: data.slug ?? pageId,
        engine,
        externalSiteId: data.external_site_id ?? mem?.externalSiteId ?? null,
        externalPageId: data.external_page_id ?? mem?.externalPageId ?? null,
        ownerUserId: this.parseOwnerUserId(data.external_owner_user_id) ?? mem?.ownerUserId ?? null,
        externalWorkspaceId: data.external_workspace_id ?? mem?.externalWorkspaceId ?? null,
      }
      this.memory.set(pageId, record)
      return record
    } catch (error) {
      this.logger.debug(`Registry get error: ${(error as Error).message}`)
      return mem
    }
  }

  async getForOwner(pageId: string, ownerUserId: number): Promise<RegistryRecord | null> {
    const record = await this.get(pageId)
    if (record?.ownerUserId != null && record.ownerUserId !== ownerUserId) {
      throw new ForbiddenException('Forbidden. You do not own this landing page mapping.')
    }
    return record
  }

  async upsert(record: RegistryRecord): Promise<RegistryRecord> {
    this.memory.set(record.pageId, record)

    if (!this.supabaseService.hasAdminClient()) {
      return record
    }

    try {
      const client = this.supabaseService.getAdminClient()
      const tryWithExternal = this.externalColumnsAvailable !== false
      const base: Record<string, unknown> = {
        id: record.pageId,
        name: record.name,
        slug: record.slug,
        render_engine: record.engine === 'instatic' ? 'instatic' : 'visual-editor',
        updated_at: new Date().toISOString(),
      }
      const payload = tryWithExternal
        ? {
            ...base,
            external_site_id: record.externalSiteId,
            external_page_id: record.externalPageId,
            external_owner_user_id: record.ownerUserId == null ? null : String(record.ownerUserId),
            external_workspace_id: record.externalWorkspaceId ?? null,
          }
        : base

      const { error } = await client.from('landing_pages').upsert(payload, { onConflict: 'id' })

      if (error) {
        const msg = error.message.toLowerCase()
        if (
          msg.includes('external_site_id') ||
          msg.includes('external_page_id') ||
          msg.includes('external_owner_user_id') ||
          msg.includes('external_workspace_id') ||
          msg.includes('schema cache')
        ) {
          this.externalColumnsAvailable = false
          this.logger.debug(
            'Registry: external_* columns unavailable — memory mapping only until migration.',
          )
        } else {
          this.logger.debug(`Registry upsert soft-fail: ${error.message}`)
        }
        return record
      }

      if (tryWithExternal) {
        this.externalColumnsAvailable = true
      }
    } catch (error) {
      this.logger.debug(`Registry upsert error: ${(error as Error).message}`)
    }

    return record
  }

  async getImportSourceHtml(pageId: string): Promise<RegistryImportSource | null> {
    if (!this.supabaseService.hasAdminClient()) {
      return null
    }

    try {
      const client = this.supabaseService.getAdminClient()
      const preferredColumns = [
        'id',
        'name',
        'slug',
        'published_html',
        'editor_data',
        'ai_source_html',
      ].join(', ')
      const fallbackColumns = 'id, name, slug, published_html, editor_data'

      let result = await client
        .from('landing_pages')
        .select(this.externalColumnsAvailable === false ? fallbackColumns : preferredColumns)
        .eq('id', pageId)
        .maybeSingle()

      if (result.error && this.isOptionalMappingColumnError(result.error.message)) {
        result = await client
          .from('landing_pages')
          .select(fallbackColumns)
          .eq('id', pageId)
          .maybeSingle()
      }

      const data = result.data as unknown as RegistryPageRow | null
      if (result.error || !data) return null

      return {
        pageId: data.id,
        name: data.name ?? pageId,
        slug: data.slug ?? pageId,
        html: this.extractHtml(data),
      }
    } catch (error) {
      this.logger.debug(`Registry import-source get error: ${(error as Error).message}`)
      return null
    }
  }

  async persistPublishedArtifact(input: {
    pageId: string
    externalPageId?: string | null
    html: string
    meta: { title: string; description?: string; ogImage?: string }
    etag: string
  }): Promise<void> {
    if (!this.supabaseService.hasAdminClient()) {
      return
    }

    const now = new Date().toISOString()

    try {
      const client = this.supabaseService.getAdminClient()
      const current = await client
        .from('landing_pages')
        .select('publish_version')
        .eq('id', input.pageId)
        .maybeSingle()
      const currentRow = current.data as RegistryPageRow | null
      const currentVersion =
        typeof currentRow?.publish_version === 'number' ? currentRow.publish_version : 0

      const base: Record<string, unknown> = {
        published_html: input.html,
        editor_data: {
          source: 'instatic',
          externalPageId: input.externalPageId ?? null,
          html: input.html,
          etag: input.etag,
          meta: input.meta,
          syncedAt: now,
        },
        render_engine: 'instatic',
        status: 'published',
        visibility: 'public',
        published_at: now,
        updated_at: now,
      }
      const payload = this.externalColumnsAvailable === false
        ? base
        : {
            ...base,
            published_meta: input.meta,
            publish_version: currentVersion + 1,
            last_synced_at: now,
          }

      const { error } = await client
        .from('landing_pages')
        .update(payload)
        .eq('id', input.pageId)

      if (error && this.isOptionalMappingColumnError(error.message)) {
        this.externalColumnsAvailable = false
        const fallbackPayload = { ...base }
        const fallback = await client
          .from('landing_pages')
          .update(fallbackPayload)
          .eq('id', input.pageId)
        if (fallback.error) {
          this.logger.warn(
            `Persist published artifact fallback failed for ${input.pageId}: ${fallback.error.message}`,
          )
        }
        return
      }

      if (error) {
        this.logger.warn(`Persist published artifact failed for ${input.pageId}: ${error.message}`)
      }
    } catch (error) {
      this.logger.warn(`Persist published artifact error: ${(error as Error).message}`)
    }
  }

  async persistDraftArtifact(input: {
    pageId: string
    externalPageId?: string | null
    html: string
    meta: { title: string; description?: string; ogImage?: string }
    etag: string
  }): Promise<void> {
    if (!this.supabaseService.hasAdminClient()) {
      return
    }

    const now = new Date().toISOString()

    try {
      const client = this.supabaseService.getAdminClient()
      const base: Record<string, unknown> = {
        editor_data: {
          source: 'instatic',
          externalPageId: input.externalPageId ?? null,
          html: input.html,
          etag: input.etag,
          meta: input.meta,
          syncedAt: now,
          draft: true,
        },
        render_engine: 'instatic',
        updated_at: now,
      }
      const payload = this.externalColumnsAvailable === false
        ? base
        : {
            ...base,
            last_synced_at: now,
          }

      const { error } = await client
        .from('landing_pages')
        .update(payload)
        .eq('id', input.pageId)

      if (error && this.isOptionalMappingColumnError(error.message)) {
        this.externalColumnsAvailable = false
        const fallback = await client
          .from('landing_pages')
          .update(base)
          .eq('id', input.pageId)
        if (fallback.error) {
          this.logger.warn(
            `Persist draft artifact fallback failed for ${input.pageId}: ${fallback.error.message}`,
          )
        }
        return
      }

      if (error) {
        this.logger.warn(`Persist draft artifact failed for ${input.pageId}: ${error.message}`)
      }
    } catch (error) {
      this.logger.warn(`Persist draft artifact error: ${(error as Error).message}`)
    }
  }

  private isOptionalMappingColumnError(message: string): boolean {
    const msg = message.toLowerCase()
    return (
      msg.includes('external_site_id') ||
      msg.includes('external_page_id') ||
      msg.includes('external_owner_user_id') ||
      msg.includes('external_workspace_id') ||
      msg.includes('last_synced_at') ||
      msg.includes('ai_source_html') ||
      msg.includes('published_meta') ||
      msg.includes('publish_version') ||
      msg.includes('schema cache')
    )
  }

  private extractHtml(row: RegistryPageRow): string | null {
    const candidates = [
      row.ai_source_html,
      row.published_html,
      this.extractEditorHtml(row.editor_data),
    ]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate
      }
    }
    return null
  }

  private extractEditorHtml(editorData: unknown): string | null {
    if (typeof editorData === 'string') {
      return editorData.trim() ? editorData : null
    }
    if (!editorData || typeof editorData !== 'object' || Array.isArray(editorData)) {
      return null
    }
    const data = editorData as Record<string, unknown>
    for (const key of ['html', 'publishedHtml', 'sourceHtml']) {
      const value = data[key]
      if (typeof value === 'string' && value.trim()) {
        return value
      }
    }
    return null
  }

  private parseOwnerUserId(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
    return null
  }

  toPageRef(record: RegistryRecord): PageRef {
    return {
      ladipageId: record.pageId,
      engine: record.engine,
      externalSiteId: record.externalSiteId,
      externalPageId: record.externalPageId,
      slug: record.slug,
      name: record.name,
    }
  }
}
