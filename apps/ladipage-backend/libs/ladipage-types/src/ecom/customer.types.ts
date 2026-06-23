/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST apiv5.sales.ldpform.net/2.0/customer/show
 */
export interface LpCustomer {
  'address_default'?: unknown | null;
  'addresses'?: unknown[];
  'custom_fields'?: unknown[];
  'customer_id'?: number;
  'detail_spend'?: LadipageJsonObject;
  'detail_spend.average'?: number;
  'detail_spend.count'?: number;
  'detail_spend.total'?: number;
  'email'?: string;
  'first_name'?: string;
  'last_name'?: string;
  'note'?: string;
  'phone'?: string;
  'recent_orders'?: unknown[];
  'tags'?: unknown[];
}
