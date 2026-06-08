import { ConfigType, registerAs } from '@nestjs/config'

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
 * Supabase and Anti-Spam configuration registration
 */
export const SupabaseConfig = registerAs(supabaseRegToken, () => ({
  useSupabaseAuth: envBoolean('USE_SUPABASE_AUTH', false),
  url: env('SUPABASE_URL', ''),
  key: env('SUPABASE_KEY', ''),
  
  // Anti-Spam domain whitelist
  allowedDomains: env('SUPABASE_ALLOWED_DOMAINS', 'gmail.com'),
  
  // Anti-Spam domain blocklist
  blockedDomains: env('SUPABASE_BLOCKED_DOMAINS', DEFAULT_TEMP_MAIL_DOMAINS),
  
  // Anti-Spam Rate limits
  limitIpCount: envNumber('REGISTRATION_LIMIT_IP_COUNT', 3),
  limitIpWindow: envNumber('REGISTRATION_LIMIT_IP_WINDOW', 600), // 10 minutes (600s)
  limitEmailCount: envNumber('REGISTRATION_LIMIT_EMAIL_COUNT', 2),
  limitEmailWindow: envNumber('REGISTRATION_LIMIT_EMAIL_WINDOW', 86400), // 24 hours (86400s)
}))

export type ISupabaseConfig = ConfigType<typeof SupabaseConfig>
