import type { ShippingProvider } from './shipping-provider'

export interface ShippingCapabilities {
  quote: boolean
  createShipment: boolean
  cancelShipment: boolean
  tracking: boolean
  provinceApi: boolean
  districtApi: boolean
  wardApi: boolean
  services: boolean
  webhook: boolean
  label: boolean
  pickup: boolean
  instantDelivery: boolean
}

const BASE_CAPABILITIES: ShippingCapabilities = {
  quote: true,
  createShipment: true,
  cancelShipment: true,
  tracking: true,
  provinceApi: false,
  districtApi: false,
  wardApi: false,
  services: true,
  webhook: false,
  label: false,
  pickup: true,
  instantDelivery: false,
}

export const SHIPPING_CAPABILITIES: Record<ShippingProvider, ShippingCapabilities> = {
  ghn: {
    ...BASE_CAPABILITIES,
    provinceApi: true,
    districtApi: true,
    wardApi: true,
  },
  ghtk: { ...BASE_CAPABILITIES, services: false },
  viettel_post: {
    ...BASE_CAPABILITIES,
    provinceApi: true,
    districtApi: true,
    wardApi: true,
  },
  jt_express: { ...BASE_CAPABILITIES },
  vnpost: { ...BASE_CAPABILITIES },
  best_express: { ...BASE_CAPABILITIES },
  ahamove: { ...BASE_CAPABILITIES, instantDelivery: true },
}
