export const SHIPPING_PROVIDERS = [
  'ghn',
  'ghtk',
  'viettel_post',
  'jt_express',
  'vnpost',
  'best_express',
  'ahamove',
] as const

export type ShippingProvider = (typeof SHIPPING_PROVIDERS)[number]

export const SHIPPING_PROVIDER_NAMES: Record<ShippingProvider, string> = {
  ghn: 'Giao Hàng Nhanh',
  ghtk: 'Giao Hàng Tiết Kiệm',
  viettel_post: 'Viettel Post',
  jt_express: 'J&T Express',
  vnpost: 'VNPost',
  best_express: 'BEST Express',
  ahamove: 'Ahamove',
}

export function isShippingProvider(value: string): value is ShippingProvider {
  return (SHIPPING_PROVIDERS as readonly string[]).includes(value)
}
