/**
 * Cloud Phone domain enums.
 * DeviceStatus mirrors GADS availability (ONLINE = live+free, BUSY = locked/in-use,
 * OFFLINE = provider not reporting). Booking/Session states are owned by Nest, not GADS.
 */

export type CloudPhoneDeviceStatus = 'ONLINE' | 'BUSY' | 'OFFLINE'

export type CloudPhoneBookingStatus = 'ACTIVE' | 'RELEASED' | 'EXPIRED'

export type CloudPhoneSessionStatus = 'STARTING' | 'RUNNING' | 'ENDED' | 'FAILED'

export type CloudPhonePlanPeriod = 'day' | 'week' | 'month'

export type CloudPhoneStreamType =
  | 'mjpeg'
  | 'android_webrtc'
  | 'ios_webrtc'

export type CloudPhoneActionType =
  | 'TAP'
  | 'SWIPE'
  | 'INPUT'
  | 'HOME'
  | 'BACK'
  | 'RECENTS'
  | 'SCREENSHOT'
  | 'INSTALL_APP'

export const CLOUD_PHONE_ACTION_TYPES: readonly CloudPhoneActionType[] = [
  'TAP',
  'SWIPE',
  'INPUT',
  'HOME',
  'BACK',
  'RECENTS',
  'SCREENSHOT',
  'INSTALL_APP',
] as const
