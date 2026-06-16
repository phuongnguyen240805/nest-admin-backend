import { ForbiddenException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, Repository } from 'typeorm'
import type {
  BusinessReportDto,
  CustomersReportDto,
  ReportChartDto,
  SalesReportDto,
} from '@liora/api-types'
import { TenantContextService } from '@liora/nest-core'

import { OrderStatus } from '../ecom-store/common/enums'
import { OrderEntity } from '../ecom-store/entities/order.entity'
import { OrderItemEntity } from '../ecom-store/entities/order-item.entity'
import { ProductEntity } from '../ecom-store/entities/product.entity'
import { CustomerEntity } from '../crm/entities/customer.entity'
import { SegmentEntity } from '../crm/entities/segment.entity'
import { CustomerSegmentEntity } from '../crm/entities/customer-segment.entity'

import {
  buildDailyLabels,
  buildSummary,
  DateRange,
  getPreviousPeriod,
  parseReportDateRange,
  toDayKey,
} from './utils/report-date.util'

interface DailyOrderAggregate {
  day: string
  revenue: string | number
  orderCount: string | number
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepository: Repository<CustomerEntity>,
    @InjectRepository(SegmentEntity)
    private readonly segmentRepository: Repository<SegmentEntity>,
    @InjectRepository(CustomerSegmentEntity)
    private readonly customerSegmentRepository: Repository<CustomerSegmentEntity>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getSalesReport(from?: string, to?: string): Promise<SalesReportDto> {
    const tenantId = this.requireTenantId();
    const range = parseReportDateRange(from, to);
    const previousRange = getPreviousPeriod(range);

    const [currentRows, previousRows] = await Promise.all([
      this.aggregateOrdersByDay(tenantId, range),
      this.aggregateOrdersByDay(tenantId, previousRange),
    ]);

    const [currentCancelledRows, previousCancelledRows] = await Promise.all([
      this.aggregateCancelledOrdersByDay(tenantId, range),
      this.aggregateCancelledOrdersByDay(tenantId, previousRange),
    ]);

    const labels = buildDailyLabels(range);
    const currentMap = this.toDailyMap(currentRows);

    const revenueSeries = labels.map((_, index) => {
      const day = toDayKey(this.addDays(range.from, index));
      return Number(currentMap.get(day)?.revenue ?? 0);
    });

    const ordersSeries = labels.map((_, index) => {
      const day = toDayKey(this.addDays(range.from, index));
      return Number(currentMap.get(day)?.orderCount ?? 0);
    });

    const aovSeries = labels.map((_, index) => {
      const day = toDayKey(this.addDays(range.from, index));
      const bucket = currentMap.get(day);
      const count = Number(bucket?.orderCount ?? 0);
      const revenue = Number(bucket?.revenue ?? 0);
      return count > 0 ? Number((revenue / count).toFixed(2)) : 0;
    });

    const cancelledMap = this.toCustomerDailyMap(
      currentCancelledRows.map((row) => ({
        day: row.day,
        count: row.orderCount,
      })),
    );
    const cancelledSeries = labels.map((_, index) => {
      const day = toDayKey(this.addDays(range.from, index));
      return Number(cancelledMap.get(day) ?? 0);
    });

    const currentRevenue = this.sumRevenue(currentRows);
    const previousRevenue = this.sumRevenue(previousRows);
    const currentOrders = this.sumOrderCount(currentRows);
    const previousOrders = this.sumOrderCount(previousRows);
    const currentAov =
      currentOrders > 0 ? Number((currentRevenue / currentOrders).toFixed(2)) : 0;
    const previousAov =
      previousOrders > 0 ? Number((previousRevenue / previousOrders).toFixed(2)) : 0;

    return {
      revenue: {
        labels,
        series: [{ name: 'Doanh thu', data: revenueSeries }],
        summary: buildSummary(currentRevenue, previousRevenue),
      },
      orders: {
        labels,
        series: [{ name: 'Đơn thành công', data: ordersSeries }],
        summary: buildSummary(currentOrders, previousOrders),
      },
      aov: {
        labels,
        series: [{ name: 'Giá trị TB/đơn', data: aovSeries }],
        summary: buildSummary(currentAov, previousAov),
      },
      cancelledOrders: {
        labels,
        series: [
          {
            name: 'Đơn huỷ',
            data: cancelledSeries,
          },
        ],
        summary: buildSummary(
          this.sumOrderCount(currentCancelledRows),
          this.sumOrderCount(previousCancelledRows),
        ),
      },
    };
  }

  async getBusinessReport(from?: string, to?: string): Promise<BusinessReportDto> {
    const tenantId = this.requireTenantId();
    const range = parseReportDateRange(from, to);
    const previousRange = getPreviousPeriod(range);

    const [orders, customers, topProducts, currentRows, previousRows] =
      await Promise.all([
        this.orderRepository.find({
          where: {
            tenantId,
            createdAt: Between(range.from, range.to),
          },
        }),
        this.customerRepository.count({
          where: {
            tenantId,
            createdAt: Between(range.from, range.to),
          },
        }),
        this.getTopProducts(tenantId, range),
        this.aggregateOrdersByDay(tenantId, range),
        this.aggregateOrdersByDay(tenantId, previousRange),
      ]);

    const completed = orders.filter((order) => order.status === OrderStatus.COMPLETED);
    const open = orders.filter(
      (order) =>
        order.status === OrderStatus.PENDING ||
        order.status === OrderStatus.UNPAID ||
        order.isIncomplete,
    );
    const failed = orders.filter((order) => order.status === OrderStatus.SPAM);

    const funnel = [
      {
        stage: 'Khách hàng mới',
        count: customers,
        revenue: 0,
      },
      {
        stage: 'Đơn hàng',
        count: orders.length,
        revenue: this.sumOrderTotals(orders),
      },
      {
        stage: 'Đang xử lý',
        count: open.length,
        revenue: this.sumOrderTotals(open),
      },
      {
        stage: 'Thành công',
        count: completed.length,
        revenue: this.sumOrderTotals(completed),
      },
      {
        stage: 'Thất bại',
        count: failed.length,
        revenue: this.sumOrderTotals(failed),
      },
    ];

    const labels = buildDailyLabels(range);
    const currentMap = this.toDailyMap(currentRows);
    const revenueSeries = labels.map((_, index) => {
      const day = toDayKey(this.addDays(range.from, index));
      return Number(currentMap.get(day)?.revenue ?? 0);
    });

    const currentRevenue = this.sumRevenue(currentRows);
    const previousRevenue = this.sumRevenue(previousRows);

    return {
      funnel,
      topProducts,
      revenue: {
        labels,
        series: [{ name: 'Doanh thu', data: revenueSeries }],
        summary: buildSummary(currentRevenue, previousRevenue),
      },
    };
  }

  async getCustomersReport(from?: string, to?: string): Promise<CustomersReportDto> {
    const tenantId = this.requireTenantId();
    const range = parseReportDateRange(from, to);
    const previousRange = getPreviousPeriod(range);
    const labels = buildDailyLabels(range);

    const [newCurrentRows, newPreviousRows, returningCurrent, returningPrevious, segments] =
      await Promise.all([
        this.aggregateNewCustomersByDay(tenantId, range),
        this.aggregateNewCustomersByDay(tenantId, previousRange),
        this.countReturningCustomers(tenantId, range),
        this.countReturningCustomers(tenantId, previousRange),
        this.getSegmentBreakdown(tenantId),
      ]);

    const currentMap = this.toCustomerDailyMap(newCurrentRows);
    const newSeries = labels.map((_, index) => {
      const day = toDayKey(this.addDays(range.from, index));
      return Number(currentMap.get(day) ?? 0);
    });

    const currentNewTotal = newSeries.reduce((sum, value) => sum + value, 0);
    const previousNewTotal = newPreviousRows.reduce(
      (sum, row) => sum + Number(row.count),
      0,
    );

    return {
      newCustomers: {
        labels,
        series: [{ name: 'Khách hàng mới', data: newSeries }],
        summary: buildSummary(currentNewTotal, previousNewTotal),
      },
      returningCustomers: {
        labels,
        series: [
          {
            name: 'Khách quay lại',
            data: labels.map(() =>
              labels.length > 0
                ? Number((returningCurrent / labels.length).toFixed(2))
                : 0,
            ),
          },
        ],
        summary: buildSummary(returningCurrent, returningPrevious),
      },
      segments,
    };
  }

  getAutomationReport(from?: string, to?: string): ReportChartDto {
    const range = parseReportDateRange(from, to);
    const labels = buildDailyLabels(range);

    return {
      labels,
      series: [
        { name: 'Workflow chạy', data: labels.map(() => 0) },
        { name: 'Tin gửi', data: labels.map(() => 0) },
      ],
      summary: buildSummary(0, 0),
    };
  }

  getJobsReport(from?: string, to?: string): ReportChartDto {
    const range = parseReportDateRange(from, to);
    const labels = buildDailyLabels(range);

    return {
      labels,
      series: [
        { name: 'Jobs hoàn thành', data: labels.map(() => 0) },
        { name: 'Jobs thất bại', data: labels.map(() => 0) },
      ],
      summary: buildSummary(0, 0),
    };
  }

  private requireTenantId(): number {
    const tenantId = this.tenantContext.getTenantId();
    if (tenantId == null) {
      throw new ForbiddenException('Tenant ID is required');
    }
    return tenantId;
  }

  private async aggregateOrdersByDay(
    tenantId: number,
    range: DateRange,
  ): Promise<DailyOrderAggregate[]> {
    return this.orderRepository
      .createQueryBuilder('order')
      .select("TO_CHAR(order.created_at, 'YYYY-MM-DD')", 'day')
      .addSelect('COALESCE(SUM(order.total), 0)', 'revenue')
      .addSelect('COUNT(order.id)', 'orderCount')
      .where('order.tenantId = :tenantId', { tenantId })
      .andWhere('order.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany<DailyOrderAggregate>();
  }

  private async aggregateNewCustomersByDay(
    tenantId: number,
    range: DateRange,
  ): Promise<Array<{ day: string; count: string | number }>> {
    return this.customerRepository
      .createQueryBuilder('customer')
      .select("TO_CHAR(customer.created_at, 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(customer.id)', 'count')
      .where('customer.tenantId = :tenantId', { tenantId })
      .andWhere('customer.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany();
  }

  private async aggregateCancelledOrdersByDay(
    tenantId: number,
    range: DateRange,
  ): Promise<DailyOrderAggregate[]> {
    return this.orderRepository
      .createQueryBuilder('order')
      .select("TO_CHAR(order.created_at, 'YYYY-MM-DD')", 'day')
      .addSelect('0', 'revenue')
      .addSelect('COUNT(order.id)', 'orderCount')
      .where('order.tenantId = :tenantId', { tenantId })
      .andWhere('order.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .andWhere('order.status = :status', { status: OrderStatus.SPAM })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany<DailyOrderAggregate>();
  }

  private async countReturningCustomers(
    tenantId: number,
    range: DateRange,
  ): Promise<number> {
    const result = await this.orderRepository
      .createQueryBuilder('order')
      .innerJoin(CustomerEntity, 'customer', 'customer.id = order.customerId')
      .where('order.tenantId = :tenantId', { tenantId })
      .andWhere('order.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .andWhere('customer.created_at < :from', { from: range.from })
      .select('COUNT(DISTINCT order.customerId)', 'count')
      .getRawOne<{ count: string }>();

    return Number(result?.count ?? 0);
  }

  private async getTopProducts(
    tenantId: number,
    range: DateRange,
  ): Promise<BusinessReportDto['topProducts']> {
    const rows = await this.orderItemRepository
      .createQueryBuilder('item')
      .innerJoin(OrderEntity, 'order', 'order.id = item.orderId')
      .leftJoin(ProductEntity, 'product', 'product.id = item.productId')
      .select('item.productId', 'productId')
      .addSelect('COALESCE(product.name, item.productName)', 'name')
      .addSelect('COALESCE(SUM(item.quantity), 0)', 'quantity')
      .addSelect('COALESCE(SUM(item.totalPrice), 0)', 'revenue')
      .where('order.tenantId = :tenantId', { tenantId })
      .andWhere('order.created_at BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .groupBy('item.productId')
      .addGroupBy('product.name')
      .addGroupBy('item.productName')
      .orderBy('quantity', 'DESC')
      .limit(10)
      .getRawMany<{
        productId: number | null;
        name: string;
        quantity: string;
        revenue: string;
      }>();

    return rows.map((row) => ({
      productId: Number(row.productId ?? 0),
      name: row.name,
      quantity: Number(row.quantity),
      revenue: Number(row.revenue),
    }));
  }

  private async getSegmentBreakdown(
    tenantId: number,
  ): Promise<CustomersReportDto['segments']> {
    const rows = await this.segmentRepository
      .createQueryBuilder('segment')
      .leftJoin(
        CustomerSegmentEntity,
        'map',
        'map.segmentId = segment.id',
      )
      .select('segment.id', 'segmentId')
      .addSelect('segment.name', 'name')
      .addSelect('COUNT(map.customerId)', 'count')
      .where('segment.tenantId = :tenantId', { tenantId })
      .groupBy('segment.id')
      .addGroupBy('segment.name')
      .orderBy('count', 'DESC')
      .getRawMany<{ segmentId: number; name: string; count: string }>();

    return rows.map((row) => ({
      segmentId: Number(row.segmentId),
      name: row.name,
      count: Number(row.count),
    }));
  }

  private toDailyMap(rows: DailyOrderAggregate[]): Map<string, DailyOrderAggregate> {
    return new Map(rows.map((row) => [row.day, row]));
  }

  private toCustomerDailyMap(
    rows: Array<{ day: string; count: string | number }>,
  ): Map<string, number> {
    return new Map(rows.map((row) => [row.day, Number(row.count)]));
  }

  private sumRevenue(rows: DailyOrderAggregate[]): number {
    return rows.reduce((sum, row) => sum + Number(row.revenue), 0);
  }

  private sumOrderCount(rows: DailyOrderAggregate[]): number {
    return rows.reduce((sum, row) => sum + Number(row.orderCount), 0);
  }

  private sumOrderTotals(orders: OrderEntity[]): number {
    return orders.reduce((sum, order) => sum + Number(order.total), 0);
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}