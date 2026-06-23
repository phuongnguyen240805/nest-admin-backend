/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladiflow.com/1.0/crm-filter/get-system-filters
 */
export interface LpCrmFilter {
  '_id'?: number;
  'conditions'?: LadipageJsonObject;
  'conditions.conditions'?: unknown[];
  'conditions.glue'?: string;
  'entity'?: string;
  'filter_type'?: string;
  'is_active'?: boolean;
  'is_editable'?: boolean;
  'is_temporary'?: boolean;
  'key_name'?: string;
  'name'?: string;
  'visibility'?: string;
}
