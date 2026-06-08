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

/**
 * Service providing authentication functions integrating with Supabase Auth.
 */
@Injectable()
export class SupabaseAuthService {
  private readonly logger = new Logger(SupabaseAuthService.name)

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Register a new user with email and password via Supabase Auth.
   * Handles check for email confirmation status.
   * 
   * @param email User email
   * @param password User password
   * @returns SupabaseSignUpResult registration details
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
    
    // Check if the user is unconfirmed (which usually means confirmation email was sent)
    const isConfirmed = data.user.confirmed_at !== undefined
    const sessionExists = data.session !== null

    let message: string | undefined
    if (!isConfirmed && !sessionExists) {
      message = 'Please check your email to confirm your registration.'
      this.logger.log(`Supabase signup successful. Email confirmation required for user: ${userId}`)
    } else {
      this.logger.log(`Supabase signup successful. User: ${userId} is auto-confirmed.`)
    }

    return {
      success: true,
      supabaseUserId: userId,
      message,
    }
  }
}
