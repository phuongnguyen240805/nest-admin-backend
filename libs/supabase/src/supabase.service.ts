import { Inject, Injectable, Logger } from '@nestjs/common'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { ISupabaseConfig, SupabaseConfig } from './supabase.config'

/**
 * Service managing the initialization and exposure of the Supabase Client.
 */
@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name)
  private client: SupabaseClient | null = null

  constructor(
    @Inject(SupabaseConfig.KEY)
    private readonly config: ISupabaseConfig,
  ) {
    this.initializeClient()
  }

  /**
   * Initializes the Supabase client using config credentials.
   * If credentials are missing, logs a warning and leaves client as null.
   */
  private initializeClient(): void {
    if (!this.config.useSupabaseAuth) {
      this.logger.log('Supabase Auth is disabled by config setting.')
      return
    }

    if (!this.config.url || !this.config.key) {
      this.logger.warn('Supabase URL or Key is missing. Supabase integration is disabled.')
      return
    }

    try {
      this.client = createClient(this.config.url, this.config.key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
      this.logger.log('Supabase client initialized successfully.')
    } catch (error) {
      this.logger.error('Failed to initialize Supabase client:', error)
    }
  }

  /**
   * Returns the initialized SupabaseClient instance.
   * Throws an error if Supabase client is not initialized.
   */
  getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase client is not initialized. Check your environment settings.')
    }
    return this.client
  }
}
