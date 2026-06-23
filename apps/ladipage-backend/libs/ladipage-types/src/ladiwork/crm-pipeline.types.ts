/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladiflow.com/1.0/crm-pipeline/list
 * - POST api.ladiflow.com/1.0/crm-pipeline/search
 */
export interface LpCrmPipeline {
  '_id'?: string;
  'alias'?: string;
  'avatar'?: unknown | null;
  'category_id'?: unknown | null;
  'count'?: number;
  'created_at'?: string;
  'creator_id'?: string;
  'custom_fields'?: unknown[];
  'deal_probability'?: boolean;
  'is_delete'?: boolean;
  'name'?: string;
  'next_time_check_notification_deal_delayer'?: string;
  'notification'?: boolean;
  'owner_id'?: string;
  'pipeline_category_id'?: unknown | null;
  'pipelines'?: unknown[];
  'prioritize_ladiuid'?: unknown[];
  'privacy_mode'?: boolean;
  'scope_object_users'?: unknown[];
  'scope_teams'?: unknown[];
  'scope_type'?: string;
  'scope_users'?: unknown[];
  'stages'?: unknown[];
  'store_id'?: string;
  'timer_notification'?: unknown | null;
  'type'?: string;
  'unit_notification'?: string;
  'updated_at'?: string;
}
