import { ConfigType, registerAs } from '@nestjs/config'

import {
  resolveSupabasePublishableKey,
  resolveSupabaseSecretKey,
} from './supabase-keys.util'

export const supabaseRegToken = 'supabase'

function env(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue
}

function envBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key]
  if (value === undefined) return defaultValue
  return value === 'true'
}

function envNumber(key: string, defaultValue: number): number {
  const value = process.env[key]
  if (value === undefined) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Common temporary mail domains used as blocklist fallback
 */
const DEFAULT_TEMP_MAIL_DOMAINS = [
  'tempmail.com', 'mailinator.com', '10minutemail.com', 'yopmail.com',
  'temp-mail.org', 'guerrillamail.com', 'sharklasers.com', 'dispostable.com',
  'getairmail.com', 'burnercmail.com', 'temp-mail.io', 'mailnesia.com',
  'maildrop.cc', 'tempmailaddress.com', 'fakeinbox.com', 'throwawaymail.com'
].join(',')

/**
 * Supabase and Anti-Spam configuration registration.
 *
 * Key naming (public vs secret):
 * - SUPABASE_PUBLISHABLE_KEY  → public, safe for client + Nest auth (preferred)
 * - SUPABASE_ANON_KEY         → public JWT anon key (fallback)
 * - SUPABASE_SECRET_KEY       → secret service_role, server-only (optional)
 *
 * Deprecated: SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
export const SupabaseConfig = registerAs(supabaseRegToken, () => {
  const publicKey = resolveSupabasePublishableKey()
  const secretKey = resolveSupabaseSecretKey()

  return {
    useSupabaseAuth: envBoolean('USE_SUPABASE_AUTH', false),
    url: env('SUPABASE_URL', ''),

    /** Public key for auth operations (publishable or anon). */
    publishableKey: publicKey.key,
    publishableKeySource: publicKey.source,
    publishableKeyKind: publicKey.kind,

    /** Secret service_role key — server-only, never expose to client. */
    secretKey,

    // Anti-Spam domain whitelist
    allowedDomains: env('SUPABASE_ALLOWED_DOMAINS', 'gmail.com'),

    // Anti-Spam domain blocklist
    blockedDomains: env('SUPABASE_BLOCKED_DOMAINS', DEFAULT_TEMP_MAIL_DOMAINS),

    // Anti-Spam Rate limits (Redis — skipped when disableRegistrationRateLimit)
    limitIpCount: envNumber('REGISTRATION_LIMIT_IP_COUNT', 3),
    limitIpWindow: envNumber('REGISTRATION_LIMIT_IP_WINDOW', 600),
    limitEmailCount: envNumber('REGISTRATION_LIMIT_EMAIL_COUNT', 10),
    limitEmailWindow: envNumber('REGISTRATION_LIMIT_EMAIL_WINDOW', 600),

    /** Dev default: skip Redis IP/email rate limits on POST /auth/register */
    disableRegistrationRateLimit: envBoolean(
      'REGISTRATION_DISABLE_RATE_LIMIT',
      process.env.NODE_ENV === 'development',
    ),

    /**
     * Dev default: create users via service_role (no confirmation email → avoids Supabase 429).
     * Requires SUPABASE_SECRET_KEY. Set SUPABASE_DEV_ADMIN_SIGNUP=false to use public signUp in dev.
     */
    useAdminSignupInDev: envBoolean(
      'SUPABASE_DEV_ADMIN_SIGNUP',
      process.env.NODE_ENV === 'development',
    ),
  }
})

export type ISupabaseConfig = ConfigType<typeof SupabaseConfig>