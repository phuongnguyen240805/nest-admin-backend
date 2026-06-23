/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladiflow.com/1.0/integration/list-all
 * - POST apiv5.ladiflow.com/1.0/integration/list-all
 */
export interface LpIntegration {
  '_id'?: string;
  'alias'?: string;
  'attachments'?: unknown[];
  'config'?: LadipageJsonObject;
  'config._id'?: string;
  'config.api_key'?: string;
  'config.refresh_token'?: string;
  'created_at'?: string;
  'creator_id'?: string;
  'is_default'?: boolean;
  'is_delete'?: boolean;
  'name'?: string;
  'owner_id'?: string;
  'scope_teams'?: unknown[];
  'scope_type'?: string;
  'scope_users'?: unknown[];
  'status'?: boolean;
  'store_id'?: string;
  'type'?: string;
  'updated_at'?: string;
}
