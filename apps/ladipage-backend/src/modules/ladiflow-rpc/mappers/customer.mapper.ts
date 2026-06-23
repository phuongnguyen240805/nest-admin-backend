import type { LpCustomer } from '@liora/ladipage-types';

export function mapCustomerRpcItem(value: LpCustomer): LpCustomer {
  // TODO(PR-P34-03): replace identity mapping with CustomerEntity -> LpCustomer after lp_customer alter.
  return value;
}
