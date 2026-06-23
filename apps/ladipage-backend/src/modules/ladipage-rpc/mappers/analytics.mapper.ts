import type { LpAnalyticsReport } from '@liora/ladipage-types';

export function mapAnalyticsReportRpcItem(value: LpAnalyticsReport): LpAnalyticsReport {
  // TODO(PR-P34-10): replace identity mapping with analytics aggregate -> CDP report item.
  return value;
}
