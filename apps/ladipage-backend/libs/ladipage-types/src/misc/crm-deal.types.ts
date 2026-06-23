/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladiflow.com/1.0/crm-deal/list
 */
export interface LpCrmDeal {
  '_id'?: string;
  'activity_status'?: string;
  'created_at'?: string;
  'customer'?: LadipageJsonObject;
  'customer_id'?: string;
  'customer.name'?: string;
  'expected_close_date'?: string;
  'final_probability'?: number;
  'identity_id'?: number;
  'labels'?: unknown[];
  'pipeline_id'?: string;
  'pipeline_stage_id'?: string;
  'position'?: number;
  'priority'?: number;
  'scope_users'?: unknown[];
  'stage_probability'?: number;
  'status'?: string;
  'title'?: string;
  'total_deal_notes'?: number;
  'total_value'?: number;
  'weighted_value'?: number;
}
