import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { TenantModule } from '@liora/nest-core'

import { CloudPhoneController } from './controllers/cloud-phone.controller'
import {
  CloudPhoneActionLogEntity,
  CloudPhoneBookingEntity,
  CloudPhonePlanEntity,
  CloudPhoneSessionEntity,
} from './entities'
import { CloudPhoneAccessService } from './services/cloud-phone-access.service'
import { CloudPhoneBookingService } from './services/cloud-phone-booking.service'
import { CloudPhoneDeviceProvider } from './services/cloud-phone-device.provider'
import { CloudPhoneSessionService } from './services/cloud-phone-session.service'
import { CloudPhoneStoreService } from './services/cloud-phone-store.service'

/**
 * CloudPhoneModule — GADS device-farm bridge (phase 1).
 * Nest owns rental/session/audit; GADS is contacted only via the device
 * provider seam. Mock mode (default) serves in-process fixtures so the FE can
 * be built and verified before GADS wiring lands.
 * Live: CLOUDPHONE_GADS_MOCK=false + GADS_CLIENT_SECRET + GADS_HUB_URL.
 */
@Module({
  imports: [
    TenantModule,
    TypeOrmModule.forFeature([
      CloudPhonePlanEntity,
      CloudPhoneBookingEntity,
      CloudPhoneSessionEntity,
      CloudPhoneActionLogEntity,
    ]),
  ],
  controllers: [CloudPhoneController],
  providers: [
    CloudPhoneAccessService,
    CloudPhoneDeviceProvider,
    CloudPhoneStoreService,
    CloudPhoneBookingService,
    CloudPhoneSessionService,
  ],
  exports: [
    CloudPhoneStoreService,
    CloudPhoneBookingService,
    CloudPhoneSessionService,
    CloudPhoneAccessService,
  ],
})
export class CloudPhoneModule {}
