import { Inject, Injectable, Logger } from '@nestjs/common'
import { createClient, type SupabaseClientOptions, SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'

import { ISupabaseConfig, SupabaseConfig } from './supabase.config'

function buildSupabaseClientOptions(): SupabaseClientOptions<'public'> {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10)

  return {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    // Node.js < 22 has no native WebSocket — required for @supabase/realtime-js
    ...(major < 22 ? { realtime: { transport: ws as never } } : {}),
  }
}

/**
 * Service managing Supabase clients (public auth + optional secret admin).
 */
@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name)
  private authClient: SupabaseClient | null = null
  private adminClient: SupabaseClient | null = null

  constructor(
    @Inject(SupabaseConfig.KEY)
    private readonly config: ISupabaseConfig,
  ) {
    this.initializeClients()
  }

  private initializeClients(): void {
    if (!this.config.useSupabaseAuth) {
      this.logger.log('Supabase Auth is disabled by config setting.')
      return
    }

    if (!this.config.url || !this.config.publishableKey) {
      this.logger.warn(
        'Supabase URL or public key is missing. '
        + 'Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY).',
      )
      return
    }

    if (this.config.publishableKeySource === 'SUPABASE_KEY (deprecated)') {
      this.logger.warn(
        'SUPABASE_KEY is deprecated. Rename to SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY.',
      )
    }

    try {
      this.authClient = createClient(
        this.config.url,
        this.config.publishableKey,
        buildSupabaseClientOptions(),
      )
      this.logger.log(
        `Supabase auth client initialized (${this.config.publishableKeyKind} key from ${this.config.publishableKeySource}).`,
      )
    }
    catch (error) {
      this.logger.error('Failed to initialize Supabase auth client:', error)
    }

    if (this.config.secretKey) {
      try {
        this.adminClient = createClient(
          this.config.url,
          this.config.secretKey,
          buildSupabaseClientOptions(),
        )
        this.logger.log('Supabase admin client initialized (secret key).')
      }
      catch (error) {
        this.logger.error('Failed to initialize Supabase admin client:', error)
      }
    }
  }

  /**
   * Public auth client — signUp, signIn, getUser. Uses publishable/anon key only.
   */
  getClient(): SupabaseClient {
    if (!this.authClient) {
      throw new Error(
        'Supabase auth client is not initialized. '
        + 'Check SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY.',
      )
    }
    return this.authClient
  }

  /**
   * Admin client — service_role secret key. Bypasses RLS. Server-only.
   */
  getAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      throw new Error(
        'Supabase admin client is not initialized. Set SUPABASE_SECRET_KEY (server-only).',
      )
    }
    return this.adminClient
  }

  hasAdminClient(): boolean {
    return this.adminClient !== null
  }
}