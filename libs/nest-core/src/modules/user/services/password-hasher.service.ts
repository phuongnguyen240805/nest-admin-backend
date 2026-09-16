import { Injectable } from '@nestjs/common'
import { compare, hash } from 'bcrypt'
import { timingSafeEqual } from 'node:crypto'

import { md5 } from '~/utils'

const BCRYPT_ROUNDS = 12
const BCRYPT_HASH = /^\$2[aby]\$/
const LEGACY_MD5_HASH = /^[a-f0-9]{32}$/i

export interface PasswordVerificationResult {
  valid: boolean
  /** Present only after a successful legacy verification. */
  upgradedHash?: string
}

/**
 * Owns password hashing policy.
 *
 * New/changed passwords are always bcrypt. The MD5 branch exists only as a
 * one-time compatibility bridge: a successful legacy login returns a bcrypt
 * replacement so callers can upgrade the stored hash immediately.
 */
@Injectable()
export class PasswordHasherService {
  hashPassword(password: string): Promise<string> {
    return hash(password, BCRYPT_ROUNDS)
  }

  async verifyPassword(
    password: string,
    storedHash: string | null | undefined,
    legacySalt: string | null | undefined,
  ): Promise<PasswordVerificationResult> {
    if (!storedHash)
      return { valid: false }

    if (BCRYPT_HASH.test(storedHash)) {
      return { valid: await compare(password, storedHash) }
    }

    if (!legacySalt || !LEGACY_MD5_HASH.test(storedHash))
      return { valid: false }

    const legacyHash = md5(`${password}${legacySalt}`)
    const actual = Buffer.from(legacyHash, 'utf8')
    const expected = Buffer.from(storedHash.toLowerCase(), 'utf8')
    const valid = actual.length === expected.length && timingSafeEqual(actual, expected)
    if (!valid)
      return { valid: false }

    return {
      valid: true,
      upgradedHash: await this.hashPassword(password),
    }
  }
}
