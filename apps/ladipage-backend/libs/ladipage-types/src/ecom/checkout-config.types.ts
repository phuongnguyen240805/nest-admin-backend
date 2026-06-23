/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST apiv5.sales.ldpform.net/2.0/checkout-config/list
 */
export interface LpCheckoutConfig {
  'checkout_config_id'?: number;
  'config'?: LadipageJsonObject;
  'config.config_customer'?: LadipageJsonObject;
  'config.config_language'?: string;
  'config.config_one_page_checkout'?: LadipageJsonObject;
  'config.config_payment'?: unknown[];
  'config.config_shipping'?: LadipageJsonObject;
  'created_at'?: string;
  'is_default'?: number;
  'name'?: string;
  'type'?: string;
  'updated_at'?: unknown | null;
}
