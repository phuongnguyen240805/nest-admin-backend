/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladiflow.com/1.0/ladiwork-dashboard/attention-stats
 * - POST api.ladiflow.com/1.0/ladiwork-dashboard/config
 * - POST api.ladiflow.com/1.0/ladiwork-dashboard/list-pipelines
 * - POST api.ladiflow.com/1.0/ladiwork-dashboard/pipeline-by-stage
 */
export interface LpLadiworkDashboard {
  '_id'?: string;
  'count'?: number;
  'expanded'?: boolean;
  'name'?: string;
  'order'?: number;
  'stage_id'?: string;
  'stage_name'?: string;
  'stages'?: unknown[];
  'total_value'?: number;
  'type'?: string;
  'visible'?: boolean;
  'widget_key'?: string;
}
