import { ForbiddenException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, In, Repository } from 'typeorm'
import type { DashboardSummaryDto, OnboardingDto } from '@liora/api-types'
import { CrmPersonService, isCrmEnabled } from '@liora/crm-core'
import { BillingService } from '@liora/nest-core/modules/billing/services/billing.service'
import { Organization } from '@liora/nest-core/modules/billing/entities/organization.entity'
import { TenantContextService } from '@liora/nest-core'

import { CustomerEntity } from '../crm/entities/customer.entity'
import { SegmentEntity } from '../crm/entities/segment.entity'
import { OrderStatus } from '../ecom-store/common/enums'
import { OrderEntity } from '../ecom-store/entities/order.entity'
import { ProductEntity } from '../ecom-store/entities/product.entity'
import {
  buildDailyLabels,
  buildSummary,
  endOfDay,
  parseReportDateRange,
  startOfDay,
  startOfWeek,
  toDayKey,
} from '../analytics/utils/report-date.util'

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepository: Repository<CustomerEntity>,
    @InjectRepository(SegmentEntity)
    private readonly segmentRepository: Repository<SegmentEntity>,
    private readonly tenantContext: TenantContextService,
    private readonly billingService: BillingService,
    private readonly personService: CrmPersonService,
  ) {}

  async getSummary(org: Organization | undefined): Promise<DashboardSummaryDto> {
    const tenantId = this.requireTenantId();
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const weekStart = startOfWeek(new Date());
    const chartRange = parseReportDateRange(
      toDayKey(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)),
      toDayKey(new Date()),
    );

    const [
      ordersToday,
      pendingOrders,
      revenueTodayRows,
      totalCustomers,
      newCustomersThisWeek,
      recentOrders,
      chartRows,
      subscription,
    ] = await Promise.all([
      this.orderRepository.count({
        where: {
          tenantId,
          createdAt: Between(todayStart, todayEnd),
        },
      }),
      this.orderRepository.count({
        where: {
          tenantId,
          status: In([OrderStatus.PENDING, OrderStatus.UNPAID]),
        },
      }),
      this.orderRepository
        .createQueryBuilder('order')
        .select('COALESCE(SUM(order.total), 0)', 'revenue')
        .where('order.tenantId = :tenantId', { tenantId })
        .andWhere('order.created_at BETWEEN :from AND :to', {
          from: todayStart,
          to: todayEnd,
        })
        .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
        .getRawOne<{ revenue: string }>(),
      this.countTotalCustomers(tenantId),
      this.countNewCustomers(weekStart, todayEnd),
      this.orderRepository.find({
        where: { tenantId },
        order: { createdAt: 'DESC' },
        take: 5,
      }),
      this.orderRepository
        .createQueryBuilder('order')
        .select("TO_CHAR(order.created_at, 'YYYY-MM-DD')", 'day')
        .addSelect('COALESCE(SUM(order.total), 0)', 'revenue')
        .where('order.tenantId = :tenantId', { tenantId })
        .andWhere('order.created_at BETWEEN :from AND :to', {
          from: chartRange.from,
          to: chartRange.to,
        })
        .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
        .groupBy('day')
        .orderBy('day', 'ASC')
        .getRawMany<{ day: string; revenue: string }>(),
      org ? this.billingService.getCurrentBilling(org) : null,
    ]);

    const labels = buildDailyLabels(chartRange);
    const chartMap = new Map(
      chartRows.map((row) => [row.day, Number(row.revenue)]),
    );
    const revenueSeries = labels.map((_, index) => {
      const day = toDayKey(this.addDays(chartRange.from, index));
      return chartMap.get(day) ?? 0;
    });
    const totalRevenue = revenueSeries.reduce<number>((sum, value) => sum + value, 0);

    return {
      ordersToday,
      pendingOrders,
      revenueToday: Number(revenueTodayRows?.revenue ?? 0),
      totalCustomers,
      newCustomersThisWeek,
      subscription,
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        code: order.code,
        customerName: order.customerName,
        total: Number(order.total),
        status: order.status,
        createdAt: order.createdAt.toISOString(),
      })),
      revenueChart: {
        labels,
        series: [{ name: 'Doanh thu 7 ngày', data: revenueSeries }],
        summary: buildSummary(totalRevenue, 0),
      },
    };
  }

  async getOnboarding(): Promise<OnboardingDto> {
    const tenantId = this.requireTenantId();

    const [
      productCount,
      orderCount,
      customerCount,
      completedOrderCount,
      segmentCount,
    ] = await Promise.all([
      this.productRepository.count({ where: { tenantId } }),
      this.orderRepository.count({ where: { tenantId } }),
      this.countTotalCustomers(tenantId),
      this.orderRepository.count({
        where: { tenantId, status: OrderStatus.COMPLETED },
      }),
      this.segmentRepository.count({ where: { tenantId } }),
    ]);

    const steps = [
      {
        id: 'has_product',
        title: 'Thêm sản phẩm đầu tiên',
        completed: productCount > 0,
      },
      {
        id: 'has_customer',
        title: 'Thêm khách hàng',
        completed: customerCount > 0,
      },
      {
        id: 'has_order',
        title: 'Nhận đơn hàng đầu tiên',
        completed: orderCount > 0,
      },
      {
        id: 'has_completed_order',
        title: 'Hoàn thành đơn hàng',
        completed: completedOrderCount > 0,
      },
      {
        id: 'has_segment',
        title: 'Tạo phân khúc khách hàng',
        completed: segmentCount > 0,
      },
    ];

    const completedCount = steps.filter((step) => step.completed).length;
    const totalCount = steps.length;

    return {
      steps,
      completedCount,
      totalCount,
      progressPercent:
        totalCount > 0
          ? Number(((completedCount / totalCount) * 100).toFixed(1))
          : 0,
    };
  }

  private async countTotalCustomers(tenantId: number): Promise<number> {
    if (isCrmEnabled()) {
      return this.personService.countActive()
    }
    return this.customerRepository.count({ where: { tenantId } })
  }

  private async countNewCustomers(from: Date, to: Date): Promise<number> {
    if (isCrmEnabled()) {
      return this.personService.countCreatedBetween(from, to)
    }
    return this.customerRepository.count({
      where: { tenantId: this.requireTenantId(), createdAt: Between(from, to) },
    })
  }

  private requireTenantId(): number {
    const tenantId = this.tenantContext.getTenantId();
    if (tenantId == null) {
      throw new ForbiddenException('Tenant ID is required');
    }
    return tenantId;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}