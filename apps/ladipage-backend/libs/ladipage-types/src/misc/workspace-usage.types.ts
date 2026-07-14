/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladiuid.com/2.0/workspace/get-usage-resource
 */
export interface LpWorkspaceUsage {
  'app_code'?: string;
  'current_usage'?: number;
  'limit_value'?: number;
  'resource_type'?: string;
}
