/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladiflow.com/1.0/customer/list
 * - POST api.ladiflow.com/1.0/customer/show
 * - POST apiv5.sales.ldpform.net/2.0/customer/show
 */
export interface LpCustomer {
  '_id'?: string;
  'address_default'?: unknown | null;
  'addresses'?: unknown[];
  'alias'?: string;
  'avatar_color'?: string;
  'avg_cancel_order_value'?: number;
  'avg_order_value'?: number;
  'avg_paid_order_value'?: number;
  'avg_pending_order_value'?: number;
  'bounce'?: number;
  'channels'?: unknown[];
  'complaint'?: number;
  'created_at'?: string;
  'creator_id'?: string;
  'custom_fields'?: unknown[];
  'customer_id'?: number;
  'detail_spend'?: LadipageJsonObject;
  'detail_spend.average'?: number;
  'detail_spend.count'?: number;
  'detail_spend.total'?: number;
  'email'?: string;
  'email_subscribe_status'?: boolean;
  'fb_page_ids'?: unknown[];
  'fb_page_uids'?: unknown[];
  'fb_uids'?: unknown[];
  'first_name'?: string;
  'followers'?: unknown[];
  'gender'?: string;
  'is_delete'?: boolean;
  'is_email_verified'?: boolean;
  'is_merge'?: boolean;
  'key'?: string;
  'ladichat_store_ids'?: unknown[];
  'ladichat_store_uids'?: unknown[];
  'ladichat_uids'?: unknown[];
  'ladisales_uid'?: number;
  'language'?: string;
  'last_name'?: string;
  'messenger_recurring_message_tokens'?: unknown[];
  'messenger_recurring_topics'?: unknown[];
  'name'?: string;
  'note'?: string;
  'organizations'?: unknown[];
  'owner_id'?: string;
  'phone'?: string;
  'phone_verified'?: boolean;
  'recent_orders'?: unknown[];
  'scope_teams'?: unknown[];
  'scope_users'?: unknown[];
  'score'?: number;
  'status'?: string;
  'store_id'?: string;
  'subscribed_at'?: string;
  'tags'?: unknown[];
  'total_cancel_order'?: number;
  'total_cancel_order_value'?: number;
  'total_order'?: number;
  'total_order_value'?: number;
  'total_paid_order'?: number;
  'total_paid_order_value'?: number;
  'total_pending_order'?: number;
  'total_pending_order_value'?: number;
  'updated_at'?: string;
  'vouchers'?: unknown[];
  'zalo_oa_ids'?: unknown[];
  'zalo_oa_uids'?: unknown[];
  'zalo_oa_uids_v2'?: unknown[];
  'zalo_uids'?: unknown[];
}
