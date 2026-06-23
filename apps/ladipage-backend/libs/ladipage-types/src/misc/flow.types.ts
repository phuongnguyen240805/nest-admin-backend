/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladiflow.com/1.0/flow/list
 */
export interface LpFlow {
  '_id'?: string;
  'alias'?: string;
  'created_at'?: string;
  'creator_id'?: string;
  'flow_config_count'?: number;
  'integration_ids'?: unknown[];
  'is_delete'?: boolean;
  'is_sharing'?: boolean;
  'name'?: string;
  'owner_id'?: string;
  'scope_teams'?: unknown[];
  'scope_type'?: string;
  'scope_users'?: unknown[];
  'status'?: string;
  'store_id'?: string;
  'sub_owner_id'?: string;
  'tags'?: unknown[];
  'total_subscribe'?: number;
  'trigger_types'?: unknown[];
  'type'?: unknown | null;
  'updated_at'?: string;
  'updated_last'?: string;
}
