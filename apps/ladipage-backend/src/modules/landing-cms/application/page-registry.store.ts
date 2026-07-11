import { Injectable, Logger } from '@nestjs/common'
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

  async get(pageId: string): Promise<RegistryRecord | null> {
    const mem = this.memory.get(pageId) ?? null

    if (!this.supabaseService.hasAdminClient()) {
      return mem
    }

    try {
      const client = this.supabaseService.getAdminClient()
      // Core columns only — do not select external_* (may not be migrated yet).
      const { data, error } = await client
        .from('landing_pages')
        .select('id, name, slug, render_engine')
        .eq('id', pageId)
        .maybeSingle()

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
        externalSiteId: mem?.externalSiteId ?? null,
        externalPageId: mem?.externalPageId ?? null,
        ownerUserId: mem?.ownerUserId ?? null,
      }
      this.memory.set(pageId, record)
      return record
    } catch (error) {
      this.logger.debug(`Registry get error: ${(error as Error).message}`)
      return mem
    }
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
          }
        : base

      const { error } = await client.from('landing_pages').upsert(payload, { onConflict: 'id' })

      if (error) {
        const msg = error.message.toLowerCase()
        if (
          msg.includes('external_site_id') ||
          msg.includes('external_page_id') ||
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
