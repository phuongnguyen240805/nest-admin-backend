import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'

import { CurrentUser, Public, TenantGuard } from '@liora/nest-core'
import { Perm } from '@liora/nest-core/modules/auth/decorators/permission.decorator'

import { CloudPhonePermissions } from '../cloud-phone.permissions'
import { CreateBookingDto } from '../dto/create-booking.dto'
import { ListDevicesQueryDto } from '../dto/list-devices-query.dto'
import { SessionActionDto } from '../dto/session-action.dto'
import { StartSessionDto } from '../dto/start-session.dto'
import { CloudPhoneAccessService } from '../services/cloud-phone-access.service'
import { CloudPhoneBookingService } from '../services/cloud-phone-booking.service'
import { CloudPhoneSessionService } from '../services/cloud-phone-session.service'
import { CloudPhoneStoreService } from '../services/cloud-phone-store.service'

/**
 * Cloud Phone REST surface. Nest owns rental/session/audit; GADS is contacted
 * only through the store/session services (mock seam for now). Every route is
 * tenant-scoped and permission-gated.
 */
@ApiTags('CloudPhone')
@SkipThrottle()
@ApiBearerAuth()
@Controller('cloudphone')
@UseGuards(TenantGuard)
export class CloudPhoneController {
  constructor(
    private readonly access: CloudPhoneAccessService,
    private readonly store: CloudPhoneStoreService,
    private readonly bookings: CloudPhoneBookingService,
    private readonly sessions: CloudPhoneSessionService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Cloud Phone / GADS bridge health' })
  health() {
    return this.store.health()
  }

  @Get('devices')
  @Perm(CloudPhonePermissions.DEVICE_READ)
  @ApiOperation({ summary: 'List rentable cloud phone devices' })
  async listDevices(@Query() query: ListDevicesQueryDto) {
    this.access.assertEnabled()
    const items = await this.store.listDevices(query)
    return { items, total: items.length, mockMode: this.access.isMockMode() }
  }

  @Get('devices/:deviceId')
  @Perm(CloudPhonePermissions.DEVICE_READ)
  @ApiOperation({ summary: 'Get one device by GADS UDID' })
  getDevice(@Param('deviceId') deviceId: string) {
    this.access.assertEnabled()
    return this.store.getDevice(deviceId)
  }

  @Get('plans')
  @Perm(CloudPhonePermissions.DEVICE_READ)
  @ApiOperation({ summary: 'List rental plans' })
  async listPlans() {
    this.access.assertEnabled()
    const items = await this.store.listPlans()
    return { items, total: items.length }
  }

  @Get('bookings')
  @Perm(CloudPhonePermissions.BOOKING_READ)
  @ApiOperation({ summary: 'List bookings for current tenant' })
  async listBookings() {
    this.access.assertEnabled()
    const items = await this.bookings.list()
    return { items, total: items.length }
  }

  @Get('bookings/:id')
  @Perm(CloudPhonePermissions.BOOKING_READ)
  @ApiOperation({ summary: 'Get booking by id' })
  getBooking(@Param('id', ParseIntPipe) id: number) {
    this.access.assertEnabled()
    return this.bookings.get(id)
  }

  @Post('bookings')
  @Perm(CloudPhonePermissions.BOOKING_WRITE)
  @ApiOperation({ summary: 'Rent a device (create booking)' })
  createBooking(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: { id?: string | number; uid?: string } | undefined,
  ) {
    this.access.assertEnabled()
    const userId = String(user?.id ?? user?.uid ?? 'unknown')
    return this.bookings.create(userId, dto)
  }

  @Delete('bookings/:id')
  @Perm(CloudPhonePermissions.BOOKING_WRITE)
  @ApiOperation({ summary: 'Release a booking' })
  releaseBooking(@Param('id', ParseIntPipe) id: number) {
    this.access.assertEnabled()
    return this.bookings.release(id)
  }

  @Post('sessions')
  @Perm(CloudPhonePermissions.SESSION_CONTROL)
  @ApiOperation({ summary: 'Start a remote-control session for a booking' })
  startSession(@Body() dto: StartSessionDto) {
    this.access.assertEnabled()
    return this.sessions.start(dto.bookingId)
  }

  @Get('sessions/:id')
  @Perm(CloudPhonePermissions.SESSION_CONTROL)
  @ApiOperation({ summary: 'Get session by id' })
  getSession(@Param('id', ParseIntPipe) id: number) {
    this.access.assertEnabled()
    return this.sessions.get(id)
  }

  @Delete('sessions/:id')
  @Perm(CloudPhonePermissions.SESSION_CONTROL)
  @ApiOperation({ summary: 'End a session' })
  endSession(@Param('id', ParseIntPipe) id: number) {
    this.access.assertEnabled()
    return this.sessions.end(id)
  }

  @Post('sessions/:id/actions')
  @Perm(CloudPhonePermissions.SESSION_CONTROL)
  @ApiOperation({ summary: 'Send a control action (tap/swipe/input/…)' })
  sendAction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SessionActionDto,
  ) {
    this.access.assertEnabled()
    return this.sessions.sendAction(id, dto)
  }
}
