import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { TenantContextService } from '@liora/nest-core'

import { TenantScopedService } from '../../../common/services/tenant-scoped.service'
import { fulfillmentFromShipmentStatus } from '../common/order-lifecycle'
import { OrderLifecycleService } from '../services/order-lifecycle.service'
import { DomainEventOutboxService } from '../../domain-events/domain-event-outbox.service'
import {
  CreateShipmentDto,
  ShippingQuoteDto,
} from '../dto/shipping.dto'
import {
  OrderEntity,
  OrderItemEntity,
  ShipmentEntity,
  ShipmentEventEntity,
  ShippingQuoteEntity,
  ShippingIntegrationEntity,
  ShippingProvider,
} from '../entities'
import {
  normalizeShipmentStatus,
  ShipmentStatus,
} from './core'
import { ShippingIntegrationService } from './shipping-integration.service'

@Injectable()
export class ShippingService extends TenantScopedService {
  constructor(
    tenantContext: TenantContextService,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItems: Repository<OrderItemEntity>,
    @InjectRepository(ShipmentEntity)
    private readonly shipments: Repository<ShipmentEntity>,
    @InjectRepository(ShipmentEventEntity)
    private readonly shipmentEvents: Repository<ShipmentEventEntity>,
    @InjectRepository(ShippingIntegrationEntity)
    private readonly integrations: Repository<ShippingIntegrationEntity>,
    @InjectRepository(ShippingQuoteEntity)
    private readonly quotes: Repository<ShippingQuoteEntity>,
    private readonly integrationService: ShippingIntegrationService,
    private readonly orderLifecycle: OrderLifecycleService,
    private readonly domainEvents: DomainEventOutboxService,
  ) {
    super(tenantContext)
  }

  integrationsList() {
    return this.integrationService.list()
  }

  saveIntegration(provider: ShippingProvider, dto: Parameters<ShippingIntegrationService['save']>[1]) {
    return this.integrationService.save(provider, dto)
  }

  testIntegration(provider: ShippingProvider) {
    return this.integrationService.test(provider)
  }

  provinces(provider: ShippingProvider) {
    this.requireGhnLocations(provider)
    return this.integrationService.execute(provider, 'getProvinces', {})
  }

  districts(provider: ShippingProvider, provinceId: number) {
    this.requireGhnLocations(provider)
    return this.integrationService.execute(provider, 'getDistricts', {
      provinceId,
    })
  }

  wards(provider: ShippingProvider, districtId: number) {
    this.requireGhnLocations(provider)
    return this.integrationService.execute(provider, 'getWards', { districtId })
  }

  services(provider: ShippingProvider, toDistrict: number) {
    if (provider !== 'ghn') throw new BadRequestException('Service catalog is only available for GHN')
    return this.integrationService.execute(provider, 'getServices', {
      toDistrict,
    })
  }

  async quote(dto: ShippingQuoteDto) {
    const params = await this.buildQuotePayload(dto)
    const result = await this.integrationService.execute(
      dto.provider,
      'calculateFee',
      params,
    )
    const raw = (result.fee ?? result) as Record<string, unknown>
    const total = Number(raw.total ?? raw.total_fee ?? raw.TotalServiceCost ?? raw.fee ?? raw.delivery ?? raw.price ?? 0)
    if (!Number.isFinite(total) || total < 0) {
      throw new ServiceUnavailableException('Shipping provider returned an invalid fee')
    }
    const serviceFee = Number(raw.service_fee ?? raw.ship_fee_only ?? 0)
    const insuranceFee = Number(raw.insurance_fee ?? 0)
    const quote = await this.quotes.save(this.quotes.create({
      tenantId: this.requireTenantId(),
      provider: dto.provider,
      serviceCode: dto.serviceCode ?? (dto.serviceId ? String(dto.serviceId) : dto.serviceTypeId ? String(dto.serviceTypeId) : null),
      serviceName: null,
      total,
      serviceFee,
      insuranceFee,
      requestPayload: dto as unknown as Record<string, unknown>,
      providerPayload: raw,
      expiresAt: new Date(Date.now() + 10 * 60_000),
      consumedAt: null,
    }))
    return {
      quoteId: quote.id,
      provider: dto.provider,
      total,
      serviceFee,
      insuranceFee,
      expiresAt: quote.expiresAt,
      raw,
    }
  }

  async detailForOrder(orderId: number) {
    const row = await this.shipments.findOne({
      where: { tenantId: this.requireTenantId(), orderId },
    })
    return row ? this.toResponse(row) : null
  }

  async verifiedFee(dto: CreateShipmentDto) {
    if (!dto.quoteId) {
      throw new BadRequestException('quoteId is required for automatic order shipping')
    }
    const quote = await this.resolveQuote(dto)
    return Number(quote!.total)
  }

  async create(orderId: number, dto: CreateShipmentDto) {
    const tenantId = this.requireTenantId()
    if (!dto.idempotencyKey?.trim()) {
      throw new BadRequestException('idempotencyKey is required to create a shipment')
    }
    if (dto.idempotencyKey) {
      const retried = await this.shipments.findOne({
        where: { tenantId, idempotencyKey: dto.idempotencyKey },
      })
      if (retried && !['PENDING_PROVIDER', 'FAILED_RETRYABLE'].includes(retried.status)) {
        return this.toResponse(retried)
      }
    }
    const existing = await this.shipments.findOne({
      where: { tenantId, orderId },
    })
    if (existing && !['CANCELLED', 'PENDING_PROVIDER', 'FAILED_RETRYABLE'].includes(existing.status)) {
      throw new BadRequestException('Order already has an active shipment')
    }
    const order = await this.findOneForTenantOrFail(
      this.orders,
      { id: orderId },
      'Order not found',
    )
    const items = await this.orderItems.find({ where: { orderId } })
    const integration = await this.integrations.findOneByOrFail({
      tenantId,
      provider: dto.provider,
    })
    if (!dto.quoteId) {
      throw new BadRequestException('quoteId is required to create a shipment')
    }
    const quote = await this.resolveQuote(dto)
    const serverFee = Number(quote.total)
    const payload = this.buildCreatePayload(
      { ...dto, fee: serverFee },
      order,
      items,
      integration.settings,
    )
    const pending = this.shipments.create({
      ...(existing ?? {}),
      tenantId,
      orderId,
      integrationId: integration.id,
      quoteId: quote.id,
      provider: dto.provider,
      trackingCode: existing?.trackingCode ?? null,
      providerOrderId: existing?.providerOrderId ?? null,
      idempotencyKey: dto.idempotencyKey.trim(),
      serviceCode: dto.serviceCode ?? (dto.serviceId ? String(dto.serviceId) : dto.serviceTypeId ? String(dto.serviceTypeId) : null),
      serviceName: dto.serviceName ?? null,
      status: 'PENDING_PROVIDER',
      providerStatus: 'PENDING_PROVIDER',
      fee: serverFee,
      codAmount: Number(dto.codAmount ?? order.total),
      recipientName: dto.recipientName,
      recipientPhone: dto.recipientPhone,
      address: dto.address.address,
      province: dto.address.province,
      district: dto.address.district,
      ward: dto.address.ward,
      providerPayload: existing?.providerPayload ?? {},
      requestPayload: payload,
      attemptCount: Number(existing?.attemptCount ?? 0) + 1,
      lastError: null,
      lastTrackedAt: existing?.lastTrackedAt ?? null,
      estimatedDeliveryAt: existing?.estimatedDeliveryAt ?? null,
    })
    await this.shipments.save(pending)
    let result: Record<string, unknown>
    try {
      result = await this.integrationService.execute(dto.provider, 'createOrder', payload)
    } catch (error) {
      pending.status = 'FAILED_RETRYABLE'
      pending.providerStatus = 'FAILED_RETRYABLE'
      pending.lastError = error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000)
      await this.shipments.save(pending)
      throw new ServiceUnavailableException('Carrier rejected or timed out while creating shipment; retry is safe with the same idempotency key')
    }
    const providerOrder = (result.order ?? result) as Record<string, unknown>
    const trackingCode = String(
        providerOrder.order_code ??
        providerOrder.orderCode ??
        providerOrder.OrderCode ??
        providerOrder.billCode ??
        providerOrder.trackingCode ??
        providerOrder.label ??
        providerOrder.label_id ??
        providerOrder.tracking_id ??
        '',
    )
    const providerOrderId = String(
      providerOrder.order_id ??
        providerOrder.orderId ??
        providerOrder.OrderId ??
        providerOrder.partner_id ??
        providerOrder.id ??
        trackingCode,
    )
    const providerStatus = String(providerOrder.status ?? providerOrder.orderStatus ?? providerOrder.Status ?? 'CREATED')
    const normalizedStatus = normalizeShipmentStatus(providerStatus, dto.provider)
    const shipment = this.shipments.create({
      ...pending,
      tenantId,
      orderId,
      integrationId: integration.id,
      provider: dto.provider,
      trackingCode: trackingCode || null,
      providerOrderId: providerOrderId || null,
      idempotencyKey: dto.idempotencyKey?.trim() || null,
      serviceCode: dto.serviceId
        ? String(dto.serviceId)
        : dto.serviceTypeId
          ? String(dto.serviceTypeId)
          : null,
      serviceName: dto.serviceName ?? null,
      status: normalizedStatus,
      providerStatus,
      fee: serverFee,
      codAmount: Number(dto.codAmount ?? order.total),
      recipientName: dto.recipientName,
      recipientPhone: dto.recipientPhone,
      address: dto.address.address,
      province: dto.address.province,
      district: dto.address.district,
      ward: dto.address.ward,
      providerPayload: providerOrder,
      requestPayload: payload,
      lastError: null,
      lastTrackedAt: new Date(),
      estimatedDeliveryAt: null,
    })
    await this.shipments.save(shipment)
    quote.consumedAt = new Date()
    await this.quotes.save(quote)
    order.shippingQuoteId = quote.id
    order.shippingFee = serverFee
    order.total = Number(order.subtotal) - Number(order.discount) + serverFee
    await this.orders.save(order)
    await this.recordEvent(shipment, providerStatus, normalizedStatus, providerOrder)
    await this.orderLifecycle.setFulfillmentStatus(
      order.id,
      fulfillmentFromShipmentStatus(normalizedStatus),
    )
    return this.toResponse(shipment)
  }

  async refresh(orderId: number) {
    const shipment = await this.requireShipment(orderId)
    if (!shipment.trackingCode) {
      throw new BadRequestException('Shipment has no tracking code')
    }
    const result = await this.integrationService.execute(
      shipment.provider,
      'getTracking',
      shipment.provider === 'ghn'
        ? { orderCode: shipment.trackingCode }
        : { trackingCode: shipment.trackingCode },
    )
    const tracking = (result.tracking ?? result) as Record<string, unknown>
    const providerStatus = String(
      tracking.status ?? tracking.current_status ?? shipment.providerStatus ?? shipment.status,
    )
    const normalizedStatus = normalizeShipmentStatus(
      providerStatus,
      shipment.provider,
    )
    shipment.providerStatus = providerStatus
    shipment.status = normalizedStatus
    shipment.providerPayload = {
      ...shipment.providerPayload,
      tracking,
    }
    shipment.lastTrackedAt = new Date()
    await this.shipments.save(shipment)
    await this.recordEvent(shipment, providerStatus, normalizedStatus, tracking)
    await this.orderLifecycle.setFulfillmentStatus(
      shipment.orderId,
      fulfillmentFromShipmentStatus(normalizedStatus),
    )
    return this.toResponse(shipment)
  }

  async retryPending(orderId: number) {
    const shipment = await this.requireShipment(orderId)
    if (!['PENDING_PROVIDER', 'FAILED_RETRYABLE'].includes(shipment.status)) {
      return this.toResponse(shipment)
    }
    shipment.status = 'PENDING_PROVIDER'
    shipment.providerStatus = 'PENDING_PROVIDER'
    shipment.attemptCount += 1
    shipment.lastError = null
    await this.shipments.save(shipment)
    let result: Record<string, unknown>
    try {
      result = await this.integrationService.execute(
        shipment.provider,
        'createOrder',
        shipment.requestPayload,
      )
    } catch (error) {
      shipment.status = 'FAILED_RETRYABLE'
      shipment.providerStatus = 'FAILED_RETRYABLE'
      shipment.lastError = error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000)
      await this.shipments.save(shipment)
      return this.toResponse(shipment)
    }
    const providerOrder = (result.order ?? result) as Record<string, unknown>
    const trackingCode = String(
      providerOrder.order_code ?? providerOrder.orderCode ?? providerOrder.OrderCode
      ?? providerOrder.billCode ?? providerOrder.trackingCode ?? providerOrder.label
      ?? providerOrder.label_id ?? providerOrder.tracking_id ?? '',
    )
    const providerOrderId = String(
      providerOrder.order_id ?? providerOrder.orderId ?? providerOrder.OrderId
      ?? providerOrder.partner_id ?? providerOrder.id ?? trackingCode,
    )
    const providerStatus = String(providerOrder.status ?? providerOrder.orderStatus ?? providerOrder.Status ?? 'CREATED')
    const normalizedStatus = normalizeShipmentStatus(providerStatus, shipment.provider)
    shipment.trackingCode = trackingCode || null
    shipment.providerOrderId = providerOrderId || null
    shipment.providerStatus = providerStatus
    shipment.status = normalizedStatus
    shipment.providerPayload = providerOrder
    shipment.lastError = null
    shipment.lastTrackedAt = new Date()
    await this.shipments.save(shipment)
    if (shipment.quoteId) {
      const quote = await this.quotes.findOne({ where: { id: shipment.quoteId, tenantId: shipment.tenantId } })
      if (quote && !quote.consumedAt) {
        quote.consumedAt = new Date()
        await this.quotes.save(quote)
      }
      const order = await this.orders.findOne({ where: { id: shipment.orderId, tenantId: shipment.tenantId } })
      if (order) {
        order.shippingQuoteId = shipment.quoteId
        order.shippingFee = Number(shipment.fee)
        order.total = Number(order.subtotal) - Number(order.discount) + Number(shipment.fee)
        await this.orders.save(order)
      }
    }
    await this.recordEvent(shipment, providerStatus, normalizedStatus, providerOrder)
    await this.orderLifecycle.setFulfillmentStatus(
      shipment.orderId,
      fulfillmentFromShipmentStatus(normalizedStatus),
    )
    return this.toResponse(shipment)
  }

  async cancel(orderId: number) {
    const shipment = await this.requireShipment(orderId)
    if (!shipment.trackingCode) {
      throw new BadRequestException('Shipment has no tracking code')
    }
    await this.integrationService.execute(
      shipment.provider,
      'cancelOrder',
      shipment.provider === 'ghn'
        ? { orderCode: shipment.trackingCode }
        : { trackingCode: shipment.trackingCode },
    )
    shipment.providerStatus = 'CANCELLED'
    shipment.status = ShipmentStatus.CANCELLED
    shipment.lastTrackedAt = new Date()
    await this.shipments.save(shipment)
    await this.recordEvent(
      shipment,
      'CANCELLED',
      ShipmentStatus.CANCELLED,
      { source: 'manual' },
    )
    await this.orderLifecycle.setFulfillmentStatus(
      shipment.orderId,
      fulfillmentFromShipmentStatus(ShipmentStatus.CANCELLED),
    )
    return this.toResponse(shipment)
  }

  async events(orderId: number) {
    const shipment = await this.requireShipment(orderId)
    return this.shipmentEvents.find({
      where: { tenantId: this.requireTenantId(), shipmentId: shipment.id },
      order: { occurredAt: 'DESC' },
    })
  }

  private async buildQuotePayload(dto: ShippingQuoteDto) {
    const parcel = {
      weight: dto.parcel?.weight ?? 500,
      length: dto.parcel?.length ?? 20,
      width: dto.parcel?.width ?? 15,
      height: dto.parcel?.height ?? 10,
    }
    if (dto.provider === 'ghn') {
      if (!dto.address.districtId || !dto.address.wardCode) {
        throw new BadRequestException('GHN requires districtId and wardCode')
      }
      if (!dto.serviceId && !dto.serviceTypeId) {
        throw new BadRequestException(
          'GHN chưa có dịch vụ hợp lệ cho tuyến này; hãy tải lại danh sách dịch vụ trước khi tính phí',
        )
      }
      return {
        ...(dto.serviceId
          ? { service_id: dto.serviceId }
          : { service_type_id: dto.serviceTypeId }),
        to_district_id: dto.address.districtId,
        to_ward_code: dto.address.wardCode,
        insurance_value: Math.min(Number(dto.insuranceValue ?? 0), 5_000_000),
        coupon: null,
        ...parcel,
      }
    }
    const integration = await this.integrations.findOneByOrFail({
      tenantId: this.requireTenantId(),
      provider: dto.provider,
    })
    const pickup = integration.settings.pickup as
      | Record<string, unknown>
      | undefined
    if (dto.provider === 'ghtk' && (!pickup?.province || !pickup?.ward)) {
      throw new BadRequestException(
        'GHTK pickup address is incomplete; province and ward are required',
      )
    }
    if (dto.provider !== 'ghtk') {
      return {
        provider: dto.provider,
        recipient: {
          name: dto.recipientName,
          phone: dto.recipientPhone,
          ...dto.address,
        },
        pickup: pickup ?? integration.settings.pickup,
        parcel,
        insuranceValue: dto.insuranceValue ?? 0,
        serviceId: dto.serviceId,
        serviceTypeId: dto.serviceTypeId,
        serviceCode: dto.serviceCode,
      }
    }
    return {
      pick_province: pickup.province,
      pick_district: pickup.district,
      pick_ward: pickup.ward ?? '',
      pick_address: pickup.address ?? '',
      province: dto.address.province,
      district: dto.address.district,
      ward: dto.address.ward,
      address: dto.address.address,
      // GHTK fee API expects weight in grams.
      weight: parcel.weight,
      value: dto.insuranceValue ?? 0,
      transport: 'road',
    }
  }

  private async resolveQuote(dto: CreateShipmentDto) {
    if (!dto.quoteId) throw new BadRequestException('quoteId is required')
    const quote = await this.quotes.findOne({
      where: { id: dto.quoteId, tenantId: this.requireTenantId(), provider: dto.provider },
    })
    if (!quote) throw new BadRequestException('Shipping quote not found')
    if (quote.consumedAt) throw new BadRequestException('Shipping quote was already used')
    if (quote.expiresAt.getTime() <= Date.now()) throw new BadRequestException('Shipping quote expired; calculate the fee again')
    return quote
  }

  private buildCreatePayload(
    dto: CreateShipmentDto,
    order: OrderEntity,
    items: OrderItemEntity[],
    settings: Record<string, unknown>,
  ): Record<string, unknown> {
    const parcel = {
      weight: dto.parcel?.weight ?? 500,
      length: dto.parcel?.length ?? 20,
      width: dto.parcel?.width ?? 15,
      height: dto.parcel?.height ?? 10,
    }
    if (dto.provider === 'ghn') {
      if (!dto.address.districtId || !dto.address.wardCode) {
        throw new BadRequestException('GHN requires districtId and wardCode')
      }
      return {
        order: {
          payment_type_id: 2,
          note: dto.note ?? order.notes ?? '',
          required_note: dto.requiredNote ?? 'KHONGCHOXEMHANG',
          client_order_code: dto.idempotencyKey,
          to_name: dto.recipientName,
          to_phone: dto.recipientPhone,
          to_address: dto.address.address,
          to_ward_code: dto.address.wardCode,
          to_district_id: dto.address.districtId,
          cod_amount: dto.codAmount ?? Number(order.total),
          content: items.map((item) => item.productName).join(', '),
          insurance_value: Math.min(Number(order.total), 5_000_000),
          service_id: dto.serviceId,
          service_type_id: dto.serviceTypeId ?? 2,
          ...parcel,
          items: items.map((item) => ({
            name: item.productName,
            quantity: item.quantity,
            price: Number(item.unitPrice),
            weight: Math.max(1, Math.round(parcel.weight / Math.max(items.length, 1))),
          })),
        },
      }
    }
    const pickup = settings.pickup as Record<string, unknown> | undefined
    if (dto.provider !== 'ghtk') {
      return {
        provider: dto.provider,
        referenceCode: order.code,
        recipient: {
          name: dto.recipientName,
          phone: dto.recipientPhone,
          ...dto.address,
        },
        pickup: pickup ?? settings.pickup,
        parcel,
        products: items.map((item) => ({
          id: item.productId ? String(item.productId) : undefined,
          name: item.productName,
          quantity: item.quantity,
          price: Number(item.unitPrice),
        })),
        codAmount: dto.codAmount ?? Number(order.total),
        insuranceValue: Number(order.total),
        serviceId: dto.serviceId,
        serviceTypeId: dto.serviceTypeId,
        serviceCode: dto.serviceCode,
        note: dto.note ?? order.notes ?? '',
      }
    }
    if (!pickup?.address || !pickup?.province || !pickup?.district || !pickup?.phone) {
      throw new BadRequestException('GHTK pickup address is not configured')
    }
    return {
      products: items.map((item) => ({
        name: item.productName,
        weight: parcel.weight / 1000,
        quantity: item.quantity,
        product_code: item.productId ? String(item.productId) : undefined,
      })),
      order: {
        id: order.code,
        pick_name: pickup.name ?? 'LadiPage Shop',
        pick_address: pickup.address,
        pick_province: pickup.province,
        pick_district: pickup.district,
        pick_ward: pickup.ward ?? '',
        pick_tel: pickup.phone,
        name: dto.recipientName,
        address: dto.address.address,
        province: dto.address.province,
        district: dto.address.district,
        ward: dto.address.ward,
        tel: dto.recipientPhone,
        is_freeship: '0',
        pick_money: dto.codAmount ?? Number(order.total),
        note: dto.note ?? order.notes ?? '',
        value: Number(order.total),
        transport: 'road',
      },
    }
  }

  private async requireShipment(orderId: number) {
    return this.findOneForTenantOrFail(
      this.shipments,
      { orderId },
      'Shipment not found',
    )
  }

  private requireGhnLocations(provider: ShippingProvider) {
    if (provider !== 'ghn' && provider !== 'viettel_post') {
      throw new BadRequestException('Location catalog is only available for GHN and Viettel Post')
    }
  }

  private async recordEvent(
    shipment: ShipmentEntity,
    providerStatus: string,
    status: ShipmentStatus,
    rawPayload: Record<string, unknown>,
  ) {
    const latest = await this.shipmentEvents.findOne({
      where: {
        tenantId: shipment.tenantId,
        shipmentId: shipment.id,
        providerStatus,
        status,
      },
      order: { occurredAt: 'DESC' },
    })
    if (latest) return latest

    const saved = await this.shipmentEvents.save(
      this.shipmentEvents.create({
        tenantId: shipment.tenantId,
        shipmentId: shipment.id,
        provider: shipment.provider,
        providerEventId: null,
        providerStatus,
        status,
        description: String(
          rawPayload.description ?? rawPayload.message ?? providerStatus,
        ),
        location: rawPayload.location ? String(rawPayload.location) : null,
        occurredAt: new Date(),
        rawPayload,
      }),
    )
    await this.domainEvents.append({
      tenantId: shipment.tenantId,
      aggregateType: 'shipment',
      aggregateId: shipment.id,
      eventType: status === ShipmentStatus.DELIVERED
        ? 'shipment.delivered'
        : shipment.status === ShipmentStatus.CREATED
          ? 'shipment.created'
          : 'shipment.status.changed',
      payload: {
        shipmentId: shipment.id,
        orderId: shipment.orderId,
        provider: shipment.provider,
        trackingCode: shipment.trackingCode,
        providerStatus,
        status,
        estimatedDeliveryAt: shipment.estimatedDeliveryAt?.toISOString() ?? null,
      },
    })
    return saved
  }

  private toResponse(row: ShipmentEntity) {
    return {
      ...row,
      fee: Number(row.fee),
      codAmount: Number(row.codAmount),
    }
  }
}
