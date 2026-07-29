import { Injectable, ServiceUnavailableException } from '@nestjs/common'

import { getCloudPhoneConfig } from '../cloud-phone.config'
import type { ListDevicesQueryDto } from '../dto/list-devices-query.dto'
import type { CloudPhoneDeviceDto, CloudPhonePlanDto } from '../types/cloud-phone.types'

/**
 * Supplies devices + plans. In mock mode (default until GADS wiring lands) it
 * serves an in-process fixture that mirrors the FE mock so the UI can be built
 * and verified end-to-end. In live mode it will call the GADS Hub adapter —
 * for now that path throws 503 so it is never silently empty.
 *
 * NOTE: this is the single seam where GADS is contacted. Nothing else in the
 * module knows the GADS host/secret exists.
 */
@Injectable()
export class CloudPhoneDeviceProvider {
  async listDevices(query: ListDevicesQueryDto): Promise<CloudPhoneDeviceDto[]> {
    const cfg = getCloudPhoneConfig()
    if (!cfg.mockMode) {
      throw new ServiceUnavailableException(
        'Cloud Phone live mode (GADS) not wired yet. Set CLOUDPHONE_GADS_MOCK=true to use mock devices.',
      )
    }

    let devices = MOCK_DEVICES.slice()
    if (query.os) {
      devices = devices.filter(d => (d.os ?? '').toLowerCase().includes(query.os as string))
    }
    if (query.status) {
      devices = devices.filter(d => d.status === query.status)
    }
    if (query.search) {
      const q = query.search.toLowerCase()
      devices = devices.filter(
        d => d.displayName.toLowerCase().includes(q) || d.id.toLowerCase().includes(q),
      )
    }
    return devices
  }

  async getDevice(deviceId: string): Promise<CloudPhoneDeviceDto | null> {
    const cfg = getCloudPhoneConfig()
    if (!cfg.mockMode) {
      throw new ServiceUnavailableException(
        'Cloud Phone live mode (GADS) not wired yet.',
      )
    }
    return MOCK_DEVICES.find(d => d.id === deviceId) ?? null
  }

  async listPlans(): Promise<CloudPhonePlanDto[]> {
    const cfg = getCloudPhoneConfig()
    if (!cfg.mockMode) {
      throw new ServiceUnavailableException(
        'Cloud Phone live mode (GADS) not wired yet.',
      )
    }
    return MOCK_PLANS.slice()
  }
}

const MOCK_PLANS: CloudPhonePlanDto[] = [
  {
    code: 'note8-basic',
    name: 'Samsung Galaxy Note 8 (Android 9)',
    priceDayVnd: 7_560,
    priceWeekVnd: 41_160,
    priceMonthVnd: 151_200,
    deviceGroup: 'Note 8',
    cpu: '8 Core',
    ram: '6 GB',
    os: 'Android 9',
    active: true,
  },
  {
    code: 'note8-change',
    name: 'Samsung Galaxy Note 8 (Android 13)',
    priceDayVnd: 10_800,
    priceWeekVnd: 58_800,
    priceMonthVnd: 216_000,
    deviceGroup: 'Note 8',
    cpu: '8 Core',
    ram: '6 GB',
    os: 'Android 13',
    active: true,
  },
  {
    code: 'emulator-8core',
    name: 'Cloud Emulator 8 Core',
    priceDayVnd: 10_800,
    priceWeekVnd: 58_800,
    priceMonthVnd: 216_000,
    deviceGroup: 'Emulator',
    cpu: '8 Core',
    ram: '8 GB',
    os: 'Android Random',
    active: true,
  },
]

const MOCK_DEVICES: CloudPhoneDeviceDto[] = [
  {
    id: 'CP-ANDROID-01',
    displayName: 'Samsung Galaxy Note 8 (Android 9)',
    serialNumber: '98897a484c563456',
    planCode: 'note8-basic',
    status: 'ONLINE',
    os: 'Android 9',
    batteryPercent: 89,
    proxyLabel: 'Proxy VN (Active)',
    proxyHost: '103.179.189.12:12323',
    runningApp: 'Facebook Auto-Share',
    note: 'Via cổ ngâm ads',
  },
  {
    id: 'CP-ANDROID-02',
    displayName: 'Samsung Galaxy Note 8 (Android 13)',
    serialNumber: '98897a484c563457',
    planCode: 'note8-change',
    status: 'ONLINE',
    os: 'Android 13',
    batteryPercent: 98,
    proxyLabel: 'Proxy VN2',
    proxyHost: '103.179.189.13:12323',
    runningApp: 'TikTok Shop Bot',
    note: 'Clone spam group',
  },
  {
    id: 'CP-ANDROID-03',
    displayName: 'Cloud Emulator',
    serialNumber: 'emulator-5554',
    planCode: 'emulator-8core',
    status: 'BUSY',
    os: 'Android Random',
    batteryPercent: 100,
    proxyLabel: 'Proxy SG',
    proxyHost: '103.179.189.14:12323',
    runningApp: 'Play Together Bot',
    note: 'Treo game Play Together',
  },
  {
    id: 'CP-ANDROID-04',
    displayName: 'Samsung Galaxy S7',
    serialNumber: 'FA76D0B0F3C2',
    planCode: 'note8-basic',
    status: 'OFFLINE',
    os: 'Android 13',
    batteryPercent: 0,
    proxyLabel: 'Proxy SG2',
    proxyHost: '103.179.189.15:12323',
    runningApp: null,
    note: 'Gói hết hạn',
  },
]
