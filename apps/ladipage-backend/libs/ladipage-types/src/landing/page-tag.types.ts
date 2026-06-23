/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladipage.com/2.0/ladi-page-tag/list
 */
export interface LpPageTag {
  '_id'?: string;
  'alias'?: string;
  'created_at'?: string;
  'creator_id'?: string;
  'is_delete'?: boolean;
  'last_use'?: string;
  'name'?: string;
  'num_ladipage'?: number;
  'owner_id'?: string;
  'position'?: number;
  'scope_teams'?: unknown[];
  'scope_users'?: unknown[];
  'status'?: boolean;
  'store_id'?: string;
  'type'?: string;
  'updated_at'?: string;
}
