/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST apiv5.sales.ldpform.net/2.0/page-checkout/list-store
 */
export interface LpPageCheckout {
  'created_at'?: string;
  'name'?: string;
  'page_checkout_id'?: number;
  'status'?: number;
  'types'?: string;
  'updated_at'?: string;
  'url_published'?: string;
}
