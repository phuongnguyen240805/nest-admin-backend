/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST apiv5.sales.ldpform.net/2.0/product/list-products
 * - POST apiv5.sales.ldpform.net/2.0/product/search
 * - POST apiv5.sales.ldpform.net/2.0/product/show
 */
export interface LpProduct {
  'alias_name'?: string;
  'checkout_config_id'?: number;
  'contact_phone'?: unknown | null;
  'content'?: unknown | null;
  'course_benefits'?: unknown | null;
  'creator_id'?: string;
  'cta'?: number;
  'custom_fields'?: unknown[];
  'description'?: string;
  'display_type'?: number;
  'domain'?: string;
  'end_date'?: unknown | null;
  'event_type'?: unknown | null;
  'external_link'?: string;
  'external_link_btn'?: unknown | null;
  'highlight_display'?: LadipageJsonObject;
  'highlight_display.config'?: LadipageJsonObject;
  'highlight_display.title'?: string;
  'highlight_display.type'?: string;
  'host_name'?: unknown | null;
  'hosted_by'?: string;
  'images'?: unknown[];
  'interface_options'?: unknown | null;
  'is_free_ship'?: number;
  'is_one_time'?: number;
  'is_selling_product'?: number;
  'is_show_all_store'?: number;
  'is_show_coupon'?: number;
  'location'?: unknown | null;
  'max_price'?: number;
  'min_price'?: number;
  'name'?: string;
  'options'?: unknown[];
  'outstanding_features'?: unknown | null;
  'page_checkout'?: LadipageJsonObject;
  'page_checkout_ids'?: unknown[];
  'page_checkout.name'?: string;
  'page_checkout.page_checkout_id'?: number;
  'path'?: string;
  'payment_redirect_after'?: number;
  'payment_redirect_url'?: unknown | null;
  'product_category_ids'?: unknown[];
  'product_id'?: number;
  'product_option_id'?: number;
  'product_up_sells'?: unknown[];
  'quantity_sold'?: number;
  'select_many_service'?: number;
  'seo'?: LadipageJsonObject;
  'seo.description'?: string;
  'seo.favicon'?: string;
  'seo.image'?: string;
  'seo.keywords'?: string;
  'seo.title'?: string;
  'short_description'?: string;
  'start_date'?: unknown | null;
  'status'?: string;
  'store_name'?: unknown | null;
  'sync_from'?: unknown | null;
  'tags'?: unknown[];
  'ticket_creation_form'?: number;
  'timezone'?: string;
  'total_student'?: unknown | null;
  'type'?: string;
  'unit'?: unknown | null;
  'url_published'?: string;
  'variants'?: unknown[];
}
