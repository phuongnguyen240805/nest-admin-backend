/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladiflow.com/1.0/broadcast/list
 */
export interface LpBroadcast {
  '_id'?: string;
  'alias'?: string;
  'conditions'?: unknown[];
  'config_type'?: unknown | null;
  'created_at'?: string;
  'creator_id'?: string;
  'email'?: LadipageJsonObject;
  'email.integration_id'?: string;
  'flow_id'?: string;
  'is_delete'?: boolean;
  'messenger'?: LadipageJsonObject;
  'name'?: string;
  'operator'?: unknown | null;
  'owner_id'?: string;
  'scope_teams'?: unknown[];
  'scope_type'?: string;
  'scope_users'?: unknown[];
  'segments'?: unknown[];
  'send_limit_option'?: unknown | null;
  'sent_date'?: string;
  'sms'?: LadipageJsonObject;
  'start_date'?: unknown | null;
  'status'?: string;
  'store_id'?: string;
  'sub_owner_id'?: string;
  'tags'?: unknown[];
  'total_click'?: number;
  'total_delivery'?: number;
  'total_read'?: number;
  'total_send'?: number;
  'type'?: string;
  'updated_at'?: string;
  'version'?: string;
  'zalo'?: LadipageJsonObject;
  'zalo.message_template_configs'?: unknown[];
}
