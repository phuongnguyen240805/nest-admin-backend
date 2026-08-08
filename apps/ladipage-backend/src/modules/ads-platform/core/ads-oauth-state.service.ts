import { createHash, randomBytes } from 'node:crypto'

import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { LessThan, Repository } from 'typeorm'

import type { AdsProvider } from '@liora/ads-contracts'

import { AdsOAuthStateEntity } from '../entities'

const STATE_TTL_MS = 10 * 60 * 1000

@Injectable()
export class AdsOAuthStateService {
  constructor(
    @InjectRepository(AdsOAuthStateEntity)
    private readonly stateRepository: Repository<AdsOAuthStateEntity>,
    private readonly configService: ConfigService,
  ) {}

  async issue(input: {
    tenantId: number
    actorId: string
    provider: AdsProvider
    returnTo?: string
  }): Promise<string> {
    const state = randomBytes(32).toString('base64url')
    await this.stateRepository.save({
      stateHash: this.hash(state),
      tenantId: input.tenantId,
      actorId: input.actorId,
      provider: input.provider,
      returnTo: this.normalizeReturnTo(input.returnTo),
      codeVerifierCiphertext: null,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
      consumedAt: null,
    })
    return state
  }

  async consume(state: string, provider: AdsProvider): Promise<AdsOAuthStateEntity> {
    if (!state?.trim()) throw new BadRequestException('OAuth state is required')
    return this.stateRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(AdsOAuthStateEntity)
      const record = await repository.findOne({
        where: { stateHash: this.hash(state), provider },
        lock: { mode: 'pessimistic_write' },
      })
      if (!record || record.consumedAt || record.expiresAt.getTime() <= Date.now()) {
        throw new BadRequestException('OAuth state is invalid, expired, or already consumed')
      }
      record.consumedAt = new Date()
      return repository.save(record)
    })
  }

  async pruneExpired(): Promise<void> {
    await this.stateRepository.delete({ expiresAt: LessThan(new Date()) })
  }

  private hash(state: string): string {
    return createHash('sha256').update(state).digest('hex')
  }

  private normalizeReturnTo(returnTo?: string): string | null {
    if (!returnTo) return null
    if (returnTo.startsWith('/') && !returnTo.startsWith('//')) return returnTo
    let url: URL
    try {
      url = new URL(returnTo)
    } catch {
      throw new BadRequestException('OAuth return target is invalid')
    }
    const allowedOrigins = (this.configService.get<string>('ADS_OAUTH_RETURN_ORIGINS') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    if (url.protocol !== 'https:' || !allowedOrigins.includes(url.origin)) {
      throw new BadRequestException('OAuth return target is not allowed')
    }
    return url.toString()
  }
}
