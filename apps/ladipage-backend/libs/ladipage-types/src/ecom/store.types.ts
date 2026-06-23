/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladipage.com/2.0/store/info
 * - POST apiv5.ladipage.com/2.0/store/info
 * - POST apiv5.sales.ldpform.net/2.0/store/get-user-info
 */
export interface LpStore {
  '_id'?: string;
  'addon'?: string;
  'created_at'?: string;
  'currency'?: string;
  'email'?: string;
  'is_delete'?: boolean;
  'is_notification_activity'?: boolean;
  'is_notification_system_error'?: boolean;
  'is_verified'?: boolean;
  'ladi_store_email'?: string;
  'ladi_uid'?: string;
  'name'?: string;
  'old_pkg_name'?: string;
  'pkg_display_name'?: string;
  'pkg_exp'?: unknown | null;
  'pkg_name'?: string;
  'pkg_name2'?: string;
  'resource_limits'?: LadipageJsonObject;
  'resource_limits.max_staff'?: number;
  'resource_limits.max_team'?: number;
  'role'?: string;
  'scopes'?: unknown | null;
  'staffs'?: unknown[];
  'status'?: boolean;
  'time_zone'?: number;
  'updated_at'?: string;
}
