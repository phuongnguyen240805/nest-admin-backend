import type { ReportChartDto } from './analytics';
import type { SubscriptionDto } from './billing';

export interface RecentOrderDto {
  id: number;
  code: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: string;
}

export interface DashboardSummaryDto {
  ordersToday: number;
  pendingOrders: number;
  revenueToday: number;
  totalCustomers: number;
  newCustomersThisWeek: number;
  subscription: SubscriptionDto | null;
  recentOrders: RecentOrderDto[];
  revenueChart: ReportChartDto;
}

export interface OnboardingStepDto {
  id: string;
  title: string;
  completed: boolean;
}

export interface OnboardingDto {
  steps: OnboardingStepDto[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
}