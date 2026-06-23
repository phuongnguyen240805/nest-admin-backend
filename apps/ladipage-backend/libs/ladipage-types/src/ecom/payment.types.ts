/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST apiv5.sales.ldpform.net/2.0/payment/list-gateways
 */
export interface LpPayment {
  'code'?: string;
  'config'?: LadipageJsonObject;
  'config.method_name'?: string;
  'config.payment_guide'?: string;
  'description'?: string;
  'mode'?: number;
  'name'?: string;
  'payment_gateway_store_config_id'?: number;
  'position'?: number;
  'status'?: number;
}
