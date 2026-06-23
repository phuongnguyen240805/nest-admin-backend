/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST apiv5.sales.ldpform.net/2.0/report/overview
 * - POST apiv5.sales.ldpform.net/2.0/report/top-product
 */
export interface LpAnalyticsReport {
  'name'?: string;
  'num_order'?: number;
  'product_id'?: number;
  'product_type'?: string;
  'quantity'?: number;
  'refund'?: unknown | null;
  'restock'?: number;
  'source'?: string;
  'total'?: number;
  'up_sell_ids'?: unknown | null;
}
