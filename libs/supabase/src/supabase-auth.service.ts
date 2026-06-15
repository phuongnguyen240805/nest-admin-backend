import { Injectable, Logger } from '@nestjs/common'
import { SupabaseService } from './supabase.service'

export interface SupabaseSignUpResult {
  /** Indicates if registration succeeded */
  success: boolean
  /** Supabase user ID if created successfully */
  supabaseUserId?: string
  /** Message warning or notification (e.g. if email confirmation is required) */
  message?: string
}

export interface SupabaseSignInResult {
  success: boolean
  supabaseUserId: string
  accessToken: string
  refreshToken?: string
  message?: string
}

export interface VerifiedSupabaseUser {
  id: string
  email?: string
  emailConfirmed: boolean
}

/**
 * Service providing authentication functions integrating with Supabase Auth.
 */
@Injectable()
export class SupabaseAuthService {
  private readonly logger = new Logger(SupabaseAuthService.name)

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Register a new user with email and password via Supabase Auth.
   */
  async signUp(email: string, password: string): Promise<SupabaseSignUpResult> {
    const client = this.supabaseService.getClient()

    this.logger.log(`Attempting Supabase signup for email: ${email}`)

    const { data, error } = await client.auth.signUp({
      email,
      password,
    })

    if (error) {
      this.logger.error(`Supabase Auth signup failed: ${error.message} (status: ${error.status})`)
      throw new Error(error.message)
    }

    if (!data.user) {
      throw new Error('Supabase did not return user details.')
    }

    const userId = data.user.id
    const isConfirmed = data.user.confirmed_at !== undefined
    const sessionExists = data.session !== null

    let message: string | undefined
    if (!isConfirmed && !sessionExists) {
      message = 'Please check your email to confirm your registration.'
      this.logger.log(`Supabase signup successful. Email confirmation required for user: ${userId}`)
    }
    else {
      this.logger.log(`Supabase signup successful. User: ${userId} is auto-confirmed.`)
    }

    return {
      success: true,
      supabaseUserId: userId,
      message,
    }
  }

  /**
   * Sign in with email/password via Supabase Auth (server-side helper).
   * Primary login flow should use Supabase client SDK; this is for tooling/tests.
   */
  async signInWithPassword(email: string, password: string): Promise<SupabaseSignInResult> {
    const client = this.supabaseService.getClient()

    this.logger.log(`Attempting Supabase sign-in for email: ${email}`)

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      this.logger.error(`Supabase Auth sign-in failed: ${error.message}`)
      throw new Error(error.message)
    }

    if (!data.user || !data.session?.access_token) {
      throw new Error('Supabase did not return a valid session.')
    }

    const isConfirmed = data.user.confirmed_at !== undefined
    let message: string | undefined
    if (!isConfirmed) {
      message = 'Please confirm your email before signing in.'
    }

    return {
      success: true,
      supabaseUserId: data.user.id,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      message,
    }
  }

  /**
   * Verify a Supabase access token and return the authenticated user profile.
   */
  async verifyAccessToken(accessToken: string): Promise<VerifiedSupabaseUser> {
    const client = this.supabaseService.getClient()

    const { data, error } = await client.auth.getUser(accessToken)

    if (error) {
      this.logger.warn(`Supabase token verification failed: ${error.message}`)
      throw new Error(error.message)
    }

    if (!data.user) {
      throw new Error('Supabase token is valid but no user was returned.')
    }

    return {
      id: data.user.id,
      email: data.user.email,
      emailConfirmed: data.user.confirmed_at !== undefined && data.user.confirmed_at !== null,
    }
  }
}