/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladiuid.com/2.0/api-key/list
 */
export interface LpApiKey {
  '_id'?: string;
  'api_key'?: string;
  'created_at'?: string;
  'creator_id'?: string;
  'is_default'?: boolean;
  'ladi_uid'?: string;
  'name'?: string;
  'scopes'?: LadipageJsonObject;
  'scopes.ladiflow'?: unknown[];
  'scopes.ladipage'?: unknown[];
  'scopes.ladisale'?: unknown[];
  'updated_at'?: string;
}
