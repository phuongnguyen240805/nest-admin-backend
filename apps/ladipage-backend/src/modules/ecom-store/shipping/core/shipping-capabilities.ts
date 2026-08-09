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
  viettel_post: { ...BASE_CAPABILITIES, provinceApi: true, districtApi: true, wardApi: true, webhook: true, label: true },
  jt_express: { ...BASE_CAPABILITIES, webhook: true, label: true },
  vnpost: { ...BASE_CAPABILITIES, label: true },
  best_express: { ...BASE_CAPABILITIES, label: true },
  ahamove: { ...BASE_CAPABILITIES, webhook: true, instantDelivery: true },
}
