/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST apiv5.sales.ldpform.net/2.0/product/show → variants
 */
export interface LpInventory {
  'allow_sold_out'?: number;
  'cost_per_item'?: number;
  'description'?: string;
  'download_count'?: number;
  'end_date'?: unknown | null;
  'file'?: string;
  'inventory_checked'?: number;
  'is_download_redirect'?: number;
  'max_buy'?: unknown | null;
  'min_buy'?: number;
  'name'?: string;
  'option_ids'?: string;
  'option_name'?: string;
  'option1'?: string;
  'options'?: unknown[];
  'package_addition_quantity'?: number;
  'package_price'?: number;
  'package_quantity'?: number;
  'package_quantity_unit'?: unknown | null;
  'position'?: number;
  'price'?: number;
  'price_compare'?: number;
  'product_id'?: number;
  'product_name'?: string;
  'product_type'?: string;
  'product_variant_id'?: number;
  'quantity'?: number;
  'rest_quantity'?: number;
  'sku'?: string;
  'src'?: unknown | null;
  'start_date'?: unknown | null;
  'status'?: string;
  'text_quantity'?: string;
  'timezone'?: string;
  'title'?: string;
  'total_quantity'?: unknown | null;
  'total_sold'?: number;
  'weight'?: number;
  'weight_unit'?: string;
}
