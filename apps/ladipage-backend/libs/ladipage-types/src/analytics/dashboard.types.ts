/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladiflow.com/1.0/dash-board/list-subscriber-by-time
 */
export interface LpDashboard {
  'date'?: string;
  'subscriber'?: number;
  'unsubscribe'?: number;
}
