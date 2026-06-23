/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladiflow.com/1.0/custom-field/list-all
 */
export interface LpCustomerCustomField {
  '_id'?: string;
  'data_type'?: string;
  'label'?: string;
  'name'?: string;
}
