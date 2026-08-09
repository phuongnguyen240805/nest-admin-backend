export enum ShipmentStatus {
  DRAFT = 'DRAFT',
  CREATED = 'CREATED',
  WAITING_PICKUP = 'WAITING_PICKUP',
  PICKING_UP = 'PICKING_UP',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERING = 'DELIVERING',
  DELIVERED = 'DELIVERED',
  DELIVERY_FAILED = 'DELIVERY_FAILED',
  RETURNING = 'RETURNING',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
}

export enum ShippingErrorCode {
  AUTH_FAILED = 'AUTH_FAILED',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_PACKAGE = 'INVALID_PACKAGE',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  QUOTE_FAILED = 'QUOTE_FAILED',
  CREATE_FAILED = 'CREATE_FAILED',
  CANCEL_FAILED = 'CANCEL_FAILED',
  TRACKING_FAILED = 'TRACKING_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  PROVIDER_TIMEOUT = 'PROVIDER_TIMEOUT',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
}

export class ShippingProviderError extends Error {
  constructor(
    readonly code: ShippingErrorCode,
    message: string,
    readonly provider?: string,
  ) {
    super(message)
    this.name = 'ShippingProviderError'
  }
}

const FINAL_STATUSES = new Set<ShipmentStatus>([
  ShipmentStatus.DELIVERED,
  ShipmentStatus.RETURNED,
  ShipmentStatus.CANCELLED,
])

export function isFinalShipmentStatus(status: ShipmentStatus): boolean {
  return FINAL_STATUSES.has(status)
}

export function normalizeShipmentStatus(
  rawStatus: unknown,
  provider?: string,
): ShipmentStatus {
  const value = String(rawStatus ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

  if (!value) return ShipmentStatus.CREATED
  if (provider === 'ghtk') {
    const ghtkStatuses: Record<string, ShipmentStatus> = {
      '-1': ShipmentStatus.CANCELLED,
      '1': ShipmentStatus.WAITING_PICKUP,
      '2': ShipmentStatus.PICKING_UP,
      '3': ShipmentStatus.PICKED_UP,
      '4': ShipmentStatus.IN_TRANSIT,
      '5': ShipmentStatus.DELIVERING,
      '6': ShipmentStatus.DELIVERED,
      '7': ShipmentStatus.DELIVERY_FAILED,
      '8': ShipmentStatus.IN_TRANSIT,
      '9': ShipmentStatus.DELIVERY_FAILED,
      '10': ShipmentStatus.RETURNING,
      '11': ShipmentStatus.RETURNED,
    }
    if (ghtkStatuses[value]) return ghtkStatuses[value]
  }
  if (['cancel', 'cancelled', 'canceled', '-1'].includes(value)) return ShipmentStatus.CANCELLED
  if (['delivered', 'success', 'completed'].includes(value)) return ShipmentStatus.DELIVERED
  if (value.includes('return')) return value.includes('returned') ? ShipmentStatus.RETURNED : ShipmentStatus.RETURNING
  if (value.includes('fail')) return ShipmentStatus.DELIVERY_FAILED
  if (value.includes('deliver')) return ShipmentStatus.DELIVERING
  if (value.includes('transit') || value.includes('transport')) return ShipmentStatus.IN_TRANSIT
  if (value.includes('picked')) return ShipmentStatus.PICKED_UP
  if (value.includes('pick')) return ShipmentStatus.PICKING_UP
  if (value.includes('ready') || value.includes('waiting')) return ShipmentStatus.WAITING_PICKUP
  return ShipmentStatus.CREATED
}
