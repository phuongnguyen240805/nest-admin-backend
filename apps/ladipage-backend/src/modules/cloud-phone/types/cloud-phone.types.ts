import {
  CloudPhoneBookingStatus,
  CloudPhoneDeviceStatus,
  CloudPhoneSessionStatus,
} from '../enums/cloud-phone.enums'

/**
 * Device as surfaced to FE. Mirrors GADS device state but flattened and
 * tenant-safe (no GADS host/secret leaked). `id` is the GADS UDID (string).
 */
export type CloudPhoneDeviceDto = {
  id: string
  displayName: string
  serialNumber: string | null
  planCode: string | null
  status: CloudPhoneDeviceStatus
  os: string | null
  batteryPercent: number | null
  proxyLabel: string | null
  proxyHost: string | null
  runningApp: string | null
  note: string | null
}

export type CloudPhonePlanDto = {
  code: string
  name: string
  priceDayVnd: number
  priceWeekVnd: number
  priceMonthVnd: number
  deviceGroup: string | null
  cpu: string | null
  ram: string | null
  os: string | null
  active: boolean
}

export type CloudPhoneBookingDto = {
  id: number
  userId: string
  gadsUdid: string
  deviceName: string | null
  planCode: string
  status: CloudPhoneBookingStatus
  bookedAt: string | null
  expiresAt: string | null
  releasedAt: string | null
}

export type CloudPhoneSessionDto = {
  id: number
  bookingId: number
  gadsSessionId: string | null
  status: CloudPhoneSessionStatus
  streamType: string | null
  startedAt: string | null
  endedAt: string | null
  durationSeconds: number
}

/** Health/status envelope (mirrors commerce health shape). */
export type CloudPhoneHealthDto = {
  enabled: boolean
  mockMode: boolean
  gadsReachable: boolean
  message: string
}
