/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladiflow.com/1.0/customer-tag/list
 * - POST api.ladiflow.com/1.0/customer-tag/list-all
 * - POST apiv5.ladiflow.com/1.0/customer-tag/list-all
 */
export interface LpCustomerTag {
  '_id'?: string;
  'alias'?: string;
  'created_at'?: string;
  'creator_id'?: string;
  'is_delete'?: boolean;
  'name'?: string;
  'owner_id'?: string;
  'position'?: number;
  'status'?: boolean;
  'store_id'?: string;
  'sub_owner_id'?: string;
  'total'?: number;
  'updated_at'?: string;
}
