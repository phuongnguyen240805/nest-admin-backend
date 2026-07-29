import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { TenantContextService } from '@liora/nest-core'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { getCloudPhoneConfig } from '../cloud-phone.config'
import { CreateBookingDto } from '../dto/create-booking.dto'
import { CloudPhoneBookingEntity } from '../entities'
import type { CloudPhonePlanPeriod } from '../enums/cloud-phone.enums'
import type { CloudPhoneBookingDto } from '../types/cloud-phone.types'
import { CloudPhoneDeviceProvider } from './cloud-phone-device.provider'

/**
 * Owns the rental lifecycle (book / list / release). Nest is the source of
 * truth for bookings; GADS only owns the physical device lock. In mock mode
 * the GADS lock step is skipped — persistence and business rules still run so
 * the FE flow can be verified end-to-end.
 */
@Injectable()
export class CloudPhoneBookingService extends TenantScopedService {
  private readonly logger = new Logger(CloudPhoneBookingService.name)

  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(CloudPhoneBookingEntity)
    private readonly repo: Repository<CloudPhoneBookingEntity>,
    private readonly deviceProvider: CloudPhoneDeviceProvider,
  ) {
    super(tenantContext)
  }

  async list(userId?: string): Promise<CloudPhoneBookingDto[]> {
    const where = userId
      ? this.tenantWhere<CloudPhoneBookingEntity>({ userId })
      : this.tenantWhere<CloudPhoneBookingEntity>()
    const rows = await this.repo.find({ where, order: { id: 'DESC' } })
    return rows.map(r => this.toDto(r))
  }

  async get(id: number): Promise<CloudPhoneBookingDto> {
    const row = await this.findOneForTenantOrFail(
      this.repo,
      { id },
      'Booking not found',
    )
    return this.toDto(row)
  }

  async create(userId: string, dto: CreateBookingDto): Promise<CloudPhoneBookingDto> {
    const tenantId = this.requireTenantId()

    const device = await this.deviceProvider.getDevice(dto.deviceId)
    if (!device) {
      throw new NotFoundException(`Device ${dto.deviceId} not found`)
    }
    if (device.status === 'OFFLINE') {
      throw new ConflictException(`Device ${dto.deviceId} is offline`)
    }

    // Guard against double-book of the same device while ACTIVE.
    const existingActive = await this.repo.findOne({
      where: this.tenantWhere<CloudPhoneBookingEntity>({
        gadsUdid: dto.deviceId,
        status: 'ACTIVE',
      }),
    })
    if (existingActive) {
      throw new ConflictException(`Device ${dto.deviceId} is already booked`)
    }

    const now = new Date()
    const expiresAt = this.computeExpiry(now, dto.period ?? 'day')

    const booking = this.repo.create({
      tenantId,
      userId,
      gadsUdid: dto.deviceId,
      deviceName: device.displayName,
      planCode: dto.planCode,
      status: 'ACTIVE',
      bookedAt: now,
      expiresAt,
      releasedAt: null,
    })
    const saved = await this.repo.save(booking)

    const cfg = getCloudPhoneConfig()
    this.logger.log(
      `Booking created id=${saved.id} device=${dto.deviceId} mock=${cfg.mockMode}`,
    )
    // TODO(P4): in live mode, acquire GADS device lock here (lease TTL).

    return this.toDto(saved)
  }

  async release(id: number): Promise<CloudPhoneBookingDto> {
    const row = await this.findOneForTenantOrFail(
      this.repo,
      { id },
      'Booking not found',
    )
    if (row.status !== 'RELEASED') {
      row.status = 'RELEASED'
      row.releasedAt = new Date()
      await this.repo.save(row)
      // TODO(P4): in live mode, release GADS device lock here.
    }
    return this.toDto(row)
  }

  private computeExpiry(from: Date, period: CloudPhonePlanPeriod): Date {
    const d = new Date(from)
    if (period === 'day') d.setDate(d.getDate() + 1)
    else if (period === 'week') d.setDate(d.getDate() + 7)
    else d.setMonth(d.getMonth() + 1)
    return d
  }

  private toDto(e: CloudPhoneBookingEntity): CloudPhoneBookingDto {
    return {
      id: e.id,
      userId: e.userId,
      gadsUdid: e.gadsUdid,
      deviceName: e.deviceName,
      planCode: e.planCode,
      status: e.status,
      bookedAt: e.bookedAt ? e.bookedAt.toISOString() : null,
      expiresAt: e.expiresAt ? e.expiresAt.toISOString() : null,
      releasedAt: e.releasedAt ? e.releasedAt.toISOString() : null,
    }
  }
}
