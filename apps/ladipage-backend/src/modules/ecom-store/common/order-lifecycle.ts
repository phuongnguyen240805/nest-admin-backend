import {
  OrderBusinessStatus,
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderStatus,
} from './enums'
import { ShipmentStatus } from '../shipping/core/shipping-status'

export interface LegacyOrderLifecycleInput {
  status: OrderStatus
  isIncomplete: boolean
  paymentMethod?: string | null
}

export interface OrderLifecycleSnapshot {
  businessStatus: OrderBusinessStatus
  paymentStatus: OrderPaymentStatus
  fulfillmentStatus: OrderFulfillmentStatus
}

export function deriveLifecycleFromLegacy(input: LegacyOrderLifecycleInput): OrderLifecycleSnapshot {
  const method = (input.paymentMethod ?? '').trim().toLowerCase()
  const businessStatus = input.status === OrderStatus.SPAM
    ? OrderBusinessStatus.SPAM
    : input.status === OrderStatus.COMPLETED
      ? OrderBusinessStatus.COMPLETED
      : input.isIncomplete
        ? OrderBusinessStatus.DRAFT
        : OrderBusinessStatus.CONFIRMED

  const paymentStatus = input.status === OrderStatus.UNPAID
    ? OrderPaymentStatus.PENDING
    : ['cod', 'cash_on_delivery', 'cash-on-delivery'].includes(method)
      ? OrderPaymentStatus.COD_PENDING
      : OrderPaymentStatus.UNKNOWN

  const fulfillmentStatus = input.status === OrderStatus.SHIPPED
    ? OrderFulfillmentStatus.SHIPPED
    : OrderFulfillmentStatus.UNFULFILLED

  return { businessStatus, paymentStatus, fulfillmentStatus }
}

export function fulfillmentFromShipmentStatus(status: ShipmentStatus): OrderFulfillmentStatus {
  switch (status) {
    case ShipmentStatus.DRAFT:
    case ShipmentStatus.CREATED:
      return OrderFulfillmentStatus.UNFULFILLED
    case ShipmentStatus.WAITING_PICKUP:
    case ShipmentStatus.PICKING_UP:
      return OrderFulfillmentStatus.READY_TO_SHIP
    case ShipmentStatus.PICKED_UP:
      return OrderFulfillmentStatus.SHIPPED
    case ShipmentStatus.IN_TRANSIT:
      return OrderFulfillmentStatus.IN_TRANSIT
    case ShipmentStatus.DELIVERING:
      return OrderFulfillmentStatus.DELIVERING
    case ShipmentStatus.DELIVERED:
      return OrderFulfillmentStatus.DELIVERED
    case ShipmentStatus.DELIVERY_FAILED:
      return OrderFulfillmentStatus.DELIVERY_FAILED
    case ShipmentStatus.RETURNING:
      return OrderFulfillmentStatus.RETURNING
    case ShipmentStatus.RETURNED:
      return OrderFulfillmentStatus.RETURNED
    case ShipmentStatus.CANCELLED:
      return OrderFulfillmentStatus.CANCELLED
  }
}

export function isCodPaymentMethod(value?: string | null): boolean {
  return ['cod', 'cash_on_delivery', 'cash-on-delivery'].includes(
    (value ?? '').trim().toLowerCase(),
  )
}
