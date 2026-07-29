import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { TenantContextService } from '@liora/nest-core'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { getCloudPhoneConfig } from '../cloud-phone.config'
import { SessionActionDto } from '../dto/session-action.dto'
import {
  CloudPhoneActionLogEntity,
  CloudPhoneBookingEntity,
  CloudPhoneSessionEntity,
} from '../entities'
import type { CloudPhoneSessionDto } from '../types/cloud-phone.types'

/**
 * Remote-control session lifecycle. Maps a Nest booking to a GADS session and
 * records control actions for audit. In mock mode no GADS call is made; the
 * session simply flips to RUNNING and actions are logged so the FE control
 * flow is verifiable before wiring.
 */
@Injectable()
export class CloudPhoneSessionService extends TenantScopedService {
  private readonly logger = new Logger(CloudPhoneSessionService.name)

  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CloudPhoneSessionEntity)
    private readonly sessionRepo: Repository<CloudPhoneSessionEntity>,
    @InjectRepository(CloudPhoneBookingEntity)
    private readonly bookingRepo: Repository<CloudPhoneBookingEntity>,
    @InjectRepository(CloudPhoneActionLogEntity)
    private readonly actionLogRepo: Repository<CloudPhoneActionLogEntity>,
  ) {
    super(tenantContext)
  }

  async start(bookingId: number): Promise<CloudPhoneSessionDto> {
    const tenantId = this.requireTenantId()

    const booking = await this.findOneForTenantOrFail(
      this.bookingRepo,
      { id: bookingId },
      'Booking not found',
    )
    if (booking.status !== 'ACTIVE') {
      throw new BadRequestException(`Booking ${bookingId} is not active`)
    }

    const cfg = getCloudPhoneConfig()
    const now = new Date()
    const session = this.sessionRepo.create({
      tenantId,
      bookingId,
      gadsSessionId: null,
      // Mock mode goes straight to RUNNING; live mode will await GADS.
      status: cfg.mockMode ? 'RUNNING' : 'STARTING',
      streamType: cfg.mockMode ? 'mjpeg' : null,
      startedAt: now,
      endedAt: null,
      durationSeconds: 0,
    })
    const saved = await this.sessionRepo.save(session)
    this.logger.log(`Session started id=${saved.id} booking=${bookingId} mock=${cfg.mockMode}`)
    // TODO(P4): in live mode, call GADS startSession + open stream relay.
    return this.toDto(saved)
  }

  async get(id: number): Promise<CloudPhoneSessionDto> {
    const row = await this.findOneForTenantOrFail(
      this.sessionRepo,
      { id },
      'Session not found',
    )
    return this.toDto(row)
  }

  async end(id: number): Promise<CloudPhoneSessionDto> {
    const row = await this.findOneForTenantOrFail(
      this.sessionRepo,
      { id },
      'Session not found',
    )
    if (row.status !== 'ENDED' && row.status !== 'FAILED') {
      const now = new Date()
      row.status = 'ENDED'
      row.endedAt = now
      row.durationSeconds = row.startedAt
        ? Math.max(0, Math.round((now.getTime() - row.startedAt.getTime()) / 1000))
        : 0
      await this.sessionRepo.save(row)
      // TODO(P4): in live mode, call GADS endSession + close relay.
    }
    return this.toDto(row)
  }

  /**
   * Records a control action against a running session. In mock mode this only
   * persists the audit log entry (no device is touched); live mode forwards to
   * GADS via the adapter.
   */
  async sendAction(sessionId: number, dto: SessionActionDto): Promise<{ accepted: boolean }> {
    const tenantId = this.requireTenantId()
    const session = await this.findOneForTenantOrFail(
      this.sessionRepo,
      { id: sessionId },
      'Session not found',
    )
    if (session.status !== 'RUNNING' && session.status !== 'STARTING') {
      throw new BadRequestException(`Session ${sessionId} is not active`)
    }

    await this.actionLogRepo.save(
      this.actionLogRepo.create({
        tenantId,
        sessionId,
        actionType: dto.type,
        payload: dto.params ?? null,
      }),
    )
    // TODO(P4): in live mode, forward action to GADS device via adapter.
    return { accepted: true }
  }

  private toDto(e: CloudPhoneSessionEntity): CloudPhoneSessionDto {
    return {
      id: e.id,
      bookingId: e.bookingId,
      gadsSessionId: e.gadsSessionId,
      status: e.status,
      streamType: e.streamType,
      startedAt: e.startedAt ? e.startedAt.toISOString() : null,
      endedAt: e.endedAt ? e.endedAt.toISOString() : null,
      durationSeconds: e.durationSeconds,
    }
  }
}
