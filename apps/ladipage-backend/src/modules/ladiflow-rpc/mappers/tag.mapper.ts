import type { LpCustomerTag } from '@liora/ladipage-types';

export function mapCustomerTagRpcItem(value: LpCustomerTag): LpCustomerTag {
  // TODO(PR-P34-08): replace identity mapping after lp_customer_tag field alignment.
  return value;
}
