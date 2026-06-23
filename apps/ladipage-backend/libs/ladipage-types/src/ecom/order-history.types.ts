/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST apiv5.sales.ldpform.net/2.0/order-history/list
 */
export interface LpOrderHistory {
  'content'?: string;
  'created_at'?: string;
  'creator_id'?: string;
  'order_history_id'?: number;
  'order_id'?: number;
  'type'?: number;
  'updated_at'?: unknown | null;
}
