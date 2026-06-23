/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST apiv5.sales.ldpform.net/2.0/order/show → order_details
 */
export interface LpOrderItem {
  'checkout_config_id'?: number;
  'custom_fields'?: unknown[];
  'discount_fee'?: number;
  'discount_maximum'?: unknown | null;
  'discount_note'?: unknown | null;
  'discount_type'?: unknown | null;
  'discount_value'?: number;
  'last_price'?: number;
  'max_buy'?: unknown | null;
  'min_buy'?: number;
  'note'?: unknown | null;
  'options'?: unknown[];
  'order_detail_id'?: number;
  'package_quantity_unit'?: unknown | null;
  'price'?: number;
  'product_id'?: number;
  'product_name'?: string;
  'product_name_full'?: string;
  'product_type'?: string;
  'product_variant_id'?: number;
  'quantity'?: number;
  'src'?: unknown | null;
  'ticket_creation_form'?: number;
  'total'?: number;
  'unit'?: string;
  'up_sell_ids'?: unknown | null;
  'weight'?: number;
}
