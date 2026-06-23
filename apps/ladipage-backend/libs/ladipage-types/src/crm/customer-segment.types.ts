/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladiflow.com/1.0/segment/list
 * - POST apiv5.ladiflow.com/1.0/segment/list-all
 */
export interface LpCustomerSegment {
  '_id'?: string;
  'alias'?: string;
  'created_at'?: string;
  'creator_id'?: string;
  'is_delete'?: boolean;
  'last_count_at'?: string;
  'multi_conditions'?: unknown[];
  'name'?: string;
  'operator'?: string;
  'owner_id'?: string;
  'store_id'?: string;
  'total'?: number;
  'type'?: string;
  'update'?: boolean;
  'updated_at'?: string;
  'use_by_flow'?: boolean;
}
