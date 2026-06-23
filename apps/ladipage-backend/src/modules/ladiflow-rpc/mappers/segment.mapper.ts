import type { LpCustomerSegment } from '@liora/ladipage-types';

export function mapSegmentRpcItem(value: LpCustomerSegment): LpCustomerSegment {
  // TODO(PR-P34-07): replace identity mapping after lp_customer_segment align migration.
  return value;
}
