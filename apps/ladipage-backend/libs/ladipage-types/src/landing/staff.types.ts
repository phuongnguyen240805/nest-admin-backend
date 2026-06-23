/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladipage.com/2.0/staff/list
 */
export interface LpStaff {
  '_id'?: string;
  'created_at'?: string;
  'email'?: string;
  'first_name'?: string;
  'is_delete'?: boolean;
  'ladi_uid'?: string;
  'last_name'?: string;
  'role'?: string;
  'scopes'?: unknown[];
  'status'?: boolean;
  'store_id'?: string;
  'teams'?: unknown[];
  'updated_at'?: string;
}
