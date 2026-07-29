import { Injectable } from '@nestjs/common'

import { getCloudPhoneConfig } from '../cloud-phone.config'
import type { ListDevicesQueryDto } from '../dto/list-devices-query.dto'
import type {
  CloudPhoneDeviceDto,
  CloudPhoneHealthDto,
  CloudPhonePlanDto,
} from '../types/cloud-phone.types'
import { CloudPhoneDeviceProvider } from './cloud-phone-device.provider'

/**
 * Read side of the store: lists rentable devices and plans for FE. Delegates
 * the actual device source to CloudPhoneDeviceProvider (mock vs GADS seam).
 */
@Injectable()
export class CloudPhoneStoreService {
  constructor(private readonly deviceProvider: CloudPhoneDeviceProvider) {}

  health(): CloudPhoneHealthDto {
    const cfg = getCloudPhoneConfig()
    return {
      enabled: cfg.enabled,
      mockMode: cfg.mockMode,
      gadsReachable: false,
      message: cfg.mockMode
        ? 'MOCK MODE: devices served from in-process fixture; GADS not contacted. '
          + 'Set CLOUDPHONE_GADS_MOCK=false + GADS_CLIENT_SECRET to go live.'
        : 'LIVE config set but GADS adapter not wired yet.',
    }
  }

  listDevices(query: ListDevicesQueryDto): Promise<CloudPhoneDeviceDto[]> {
    return this.deviceProvider.listDevices(query)
  }

  getDevice(deviceId: string): Promise<CloudPhoneDeviceDto | null> {
    return this.deviceProvider.getDevice(deviceId)
  }

  listPlans(): Promise<CloudPhonePlanDto[]> {
    return this.deviceProvider.listPlans()
  }
}
