import type { LpOrder } from '@liora/ladipage-types';

export function mapOrderListRpcItem(value: LpOrder): LpOrder {
  // TODO(PR-03): replace identity mapping with entity -> CDP field mapping after lp_order entity is expanded.
  return value;
}
