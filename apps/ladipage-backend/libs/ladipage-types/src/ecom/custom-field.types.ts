/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST apiv5.sales.ldpform.net/2.0/custom-field/list
 */
export interface LpCustomField {
  'created_at'?: string;
  'creator_id'?: string;
  'custom_field_id'?: number;
  'data_type'?: string;
  'data_values'?: unknown | null;
  'group_type'?: string;
  'label'?: string;
  'name'?: string;
  'status'?: number;
  'updated_at'?: unknown | null;
}
