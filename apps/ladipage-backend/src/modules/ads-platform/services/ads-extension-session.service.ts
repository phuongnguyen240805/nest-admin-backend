import { createHash, randomBytes } from 'node:crypto'

import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { MoreThan, Repository } from 'typeorm'

import { AdsExtensionSessionEntity } from '../entities'

@Injectable()
export class AdsExtensionSessionService {
  constructor(
    @InjectRepository(AdsExtensionSessionEntity)
    private readonly sessions: Repository<AdsExtensionSessionEntity>,
    private readonly configService: ConfigService,
  ) {}

  async issue(input: { tenantId: number; actorId: string; deviceId: string }) {
    const accessToken = randomBytes(32).toString('base64url')
    const ttlSeconds = this.ttlSeconds()
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000)
    const session = await this.sessions.save({
      tenantId: input.tenantId,
      actorId: input.actorId,
      deviceId: input.deviceId,
      tokenHash: this.hash(accessToken),
      expiresAt,
      lastSeenAt: null,
      revokedAt: null,
    })
    return { sessionId: session.id, accessToken, expiresAt: expiresAt.toISOString() }
  }

  async authenticate(accessToken: string, deviceId: string): Promise<AdsExtensionSessionEntity> {
    if (!accessToken) throw new UnauthorizedException('Extension session token is required')
    if (!deviceId) throw new UnauthorizedException('Extension device ID is required')
    const session = await this.sessions.findOneBy({
      tokenHash: this.hash(accessToken),
      deviceId,
      revokedAt: null,
      expiresAt: MoreThan(new Date()),
    })
    if (!session) throw new UnauthorizedException('Extension session is invalid or expired')
    session.lastSeenAt = new Date()
    return this.sessions.save(session)
  }

  private ttlSeconds(): number {
    const configured = Number(this.configService.get<string>('ADS_EXTENSION_SESSION_TTL_SECONDS') ?? 600)
    return Math.min(Math.max(Number.isFinite(configured) ? configured : 600, 60), 900)
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
