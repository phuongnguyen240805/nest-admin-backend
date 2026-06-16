export interface ReportSummaryDto {
  total: number;
  change: number;
  changePercent: number;
}

export interface ReportSeriesDto {
  name: string;
  data: number[];
}

/** ApexCharts-compatible chart payload */
export interface ReportChartDto {
  labels: string[];
  series: ReportSeriesDto[];
  summary: ReportSummaryDto;
}

export interface SalesReportDto {
  revenue: ReportChartDto;
  orders: ReportChartDto;
  aov: ReportChartDto;
  cancelledOrders: ReportChartDto;
}

export interface FunnelStageDto {
  stage: string;
  count: number;
  revenue: number;
}

export interface TopProductDto {
  productId: number;
  name: string;
  quantity: number;
  revenue: number;
}

export interface BusinessReportDto {
  funnel: FunnelStageDto[];
  topProducts: TopProductDto[];
  revenue: ReportChartDto;
}

export interface SegmentBreakdownDto {
  segmentId: number;
  name: string;
  count: number;
}

export interface CustomersReportDto {
  newCustomers: ReportChartDto;
  returningCustomers: ReportChartDto;
  segments: SegmentBreakdownDto[];
}