import { Injectable, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, Repository } from 'typeorm'

import { loadContractFixtureData } from '../../common/utils/contract-fixture.util'
import type { RpcContext } from '../ladipage-rpc/rpc-dispatcher.service'
import { mapAnalyticsReportRpcItem } from '../ladipage-rpc/mappers/analytics.mapper'
import { OrderStatus } from '../ecom-store/common/enums'
import { OrderEntity } from '../ecom-store/entities/order.entity'
import { AnalyticsReportEntity } from './entities'

type JsonRecord = Record<string, unknown>

@Injectable()
export class AnalyticsReportRpcService {
  constructor(
    @Optional()
    @InjectRepository(AnalyticsReportEntity)
    private readonly reportRepository?: Repository<AnalyticsReportEntity>,
    @Optional()
    @InjectRepository(OrderEntity)
    private readonly orderRepository?: Repository<OrderEntity>,
  ) {}

  overview(body: JsonRecord, ctx: RpcContext): JsonRecord {
    if (this.orderRepository && ctx.tenantId != null) {
      return this.overviewFromRepository(body, ctx) as unknown as JsonRecord
    }

    return this.overviewFixture()
  }

  topProduct(_body: JsonRecord, ctx: RpcContext): JsonRecord {
    if (this.reportRepository) {
      return this.topProductFromRepository(ctx) as unknown as JsonRecord
    }

    return this.topProductFixture()
  }

  private async overviewFromRepository(body: JsonRecord, ctx: RpcContext): Promise<JsonRecord> {
    const template = this.overviewFixture()
    const from = this.parseDate(body.from_date) ?? new Date(0)
    const to = this.parseDate(body.to_date) ?? new Date()
    const orders = await this.orderRepository!.find({
      where: {
        tenantId: ctx.tenantId,
        createdAt: Between(from, to),
      },
      order: { createdAt: 'ASC' },
    })

    if (orders.length === 0) return this.emptyOverview(template)

    const successOrders = orders.filter((order) => order.status === OrderStatus.COMPLETED)
    const cancelOrders = orders.filter((order) => order.status === OrderStatus.SPAM)
    const totalRevenue = this.sumTotals(successOrders)
    const totalSuccess = successOrders.length
    const totalCancel = cancelOrders.length

    return {
      total_revenue: totalRevenue,
      total_order_success: totalSuccess,
      total_order_cancel: totalCancel,
      average_order: totalSuccess > 0 ? Number((totalRevenue / totalSuccess).toFixed(2)) : 0,
      revenue_source: [{
        source: 'Landing Page',
        total: totalRevenue,
        refund: null,
        num_order: totalSuccess,
      }],
      revenue_day: {
        revenueSuccess: this.groupRevenueByDay(successOrders),
        revenuePending: [],
      },
      num_orders_day: {
        orderSuccess: this.groupCountByDay(successOrders, 'total_success'),
        orderPending: [],
        orderCancel: this.groupCountByDay(cancelOrders, 'total_cancel'),
      },
      revenue_by_staff: { resultSuccess: [], resultPending: [] },
      revenue_utm: template.revenue_utm ?? {},
      report_by_staff: [],
      report_compare: template.report_compare ?? {},
    }
  }

  private async topProductFromRepository(ctx: RpcContext): Promise<JsonRecord> {
    const query = this.reportRepository!.createQueryBuilder('report')
      .where('report.report_type = :reportType', { reportType: 'top_product' })

    if (ctx.tenantId != null) {
      query.andWhere('report.tenantId = :tenantId', { tenantId: ctx.tenantId })
    }

    const rows = await query
      .orderBy('report.quantity', 'DESC')
      .addOrderBy('report.total', 'DESC')
      .limit(10)
      .getMany()

    if (rows.length === 0 && ctx.tenantId == null) return this.topProductFixture()

    return {
      top_product: rows.map((row) => mapAnalyticsReportRpcItem(row as unknown as JsonRecord)),
      report_compare: {
        top_product: [],
      },
    }
  }

  private overviewFixture(): JsonRecord {
    return loadContractFixtureData<JsonRecord>('phase4', 'report__overview.json')
  }

  private topProductFixture(): JsonRecord {
    return loadContractFixtureData<JsonRecord>('phase4', 'report__top-product.json')
  }

  private emptyOverview(template: JsonRecord): JsonRecord {
    return {
      total_revenue: 0,
      total_order_success: 0,
      total_order_cancel: 0,
      average_order: 0,
      revenue_source: [],
      revenue_day: { revenueSuccess: [], revenuePending: [] },
      num_orders_day: { orderSuccess: [], orderPending: [], orderCancel: [] },
      revenue_by_staff: { resultSuccess: [], resultPending: [] },
      revenue_utm: template.revenue_utm ?? {},
      report_by_staff: [],
      report_compare: template.report_compare ?? {},
    }
  }

  private parseDate(value: unknown): Date | null {
    if (!value) return null
    if (value instanceof Date) return value
    const normalized = String(value)
      .replace(/^(\d{4}-\d{2}-\d{2})\s/, '$1T')
      .replace(/\s([+-]\d{2}:\d{2})$/, '$1')
    const date = new Date(normalized)
    return Number.isNaN(date.getTime()) ? null : date
  }

  private sumTotals(orders: OrderEntity[]): number {
    return orders.reduce((sum, order) => sum + Number(order.total ?? 0), 0)
  }

  private groupRevenueByDay(orders: OrderEntity[]): JsonRecord[] {
    const totals = new Map<string, number>()
    for (const order of orders) {
      const day = this.dayKey(order.createdAt)
      totals.set(day, (totals.get(day) ?? 0) + Number(order.total ?? 0))
    }

    return Array.from(totals.entries()).map(([date, total]) => ({
      total,
      refund: null,
      date,
    }))
  }

  private groupCountByDay(orders: OrderEntity[], countKey: string): JsonRecord[] {
    const counts = new Map<string, number>()
    for (const order of orders) {
      const day = this.dayKey(order.createdAt)
      counts.set(day, (counts.get(day) ?? 0) + 1)
    }

    return Array.from(counts.entries()).map(([date, count]) => ({
      [countKey]: count,
      date,
    }))
  }

  private dayKey(value: Date): string {
    const date = value instanceof Date ? value : new Date(value)
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    )).toISOString()
  }
}
