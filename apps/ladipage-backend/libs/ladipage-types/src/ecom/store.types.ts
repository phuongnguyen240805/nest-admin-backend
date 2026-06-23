/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladipage.com/2.0/store/info
 * - POST apiv5.ladipage.com/2.0/store/info
 * - POST apiv5.sales.ldpform.net/2.0/store/get-user-info
 * - POST apiv5.sales.ldpform.net/2.0/store/show
 */
export interface LpStore {
  '_id'?: string;
  'addon'?: string;
  'address'?: string;
  'country_code'?: string;
  'country_name'?: string;
  'course_pkg_exp'?: unknown | null;
  'course_pkg_name'?: string;
  'cover_url'?: string;
  'created_at'?: string;
  'currency'?: string;
  'currency_code'?: string;
  'currency_symbol'?: string;
  'description'?: unknown | null;
  'district_id'?: number;
  'district_name'?: string;
  'email'?: string;
  'email_hook'?: string;
  'favicon_url'?: unknown | null;
  'is_delete'?: boolean;
  'is_notification_activity'?: boolean;
  'is_notification_system_error'?: boolean;
  'is_verified'?: boolean;
  'ladi_store_email'?: string;
  'ladi_uid'?: string;
  'logo_url'?: unknown | null;
  'name'?: string;
  'old_pkg_name'?: string;
  'order_prefix'?: string;
  'phone'?: string;
  'pkg_display_name'?: string;
  'pkg_exp'?: unknown | null;
  'pkg_name'?: string;
  'pkg_name2'?: string;
  'postal_code'?: string;
  'privacy_policy'?: unknown | null;
  'refund_policy'?: unknown | null;
  'resource_limits'?: LadipageJsonObject;
  'resource_limits.max_staff'?: number;
  'resource_limits.max_team'?: number;
  'role'?: string;
  'scopes'?: unknown | null;
  'staffs'?: unknown[];
  'state_id'?: number;
  'state_name'?: string;
  'status'?: boolean;
  'store_id'?: number;
  'terms_of_use'?: unknown | null;
  'ticket_seat_prefix'?: string;
  'time_zone'?: number;
  'timezone'?: string;
  'updated_at'?: string;
  'ward_id'?: number;
  'ward_name'?: string;
}
