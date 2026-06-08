import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SupabaseConfig } from './supabase.config'
import { SupabaseService } from './supabase.service'
import { SupabaseAuthService } from './supabase-auth.service'

/**
 * Library integration module for Supabase Client and Auth capabilities.
 */
@Module({
  imports: [ConfigModule.forFeature(SupabaseConfig)],
  providers: [SupabaseService, SupabaseAuthService],
  exports: [SupabaseService, SupabaseAuthService, ConfigModule],
})
export class SupabaseModule {}
