/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST apiv5.sales.ldpform.net/2.0/order-tag/list
 * - POST apiv5.sales.ldpform.net/2.0/order-tag/list-all
 */
export interface LpOrderTag {
  'color'?: string;
  'created_at'?: string;
  'name'?: string;
  'order_tag_id'?: number;
  'quantity'?: number;
  'store_id'?: number;
  'updated_at'?: string;
}
