/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladiflow.com/1.0/ladipage-notification/list
 */
export interface LpNotification {
  '_id'?: string;
  'channel'?: string;
  'content'?: string;
  'created_at'?: string;
  'event'?: unknown | null;
  'group'?: string;
  'is_read'?: boolean;
  'overrides'?: LadipageJsonObject;
  'overrides.apns'?: LadipageJsonObject;
  'overrides.fcm'?: LadipageJsonObject;
  'owner_id'?: string;
  'payload'?: LadipageJsonObject;
  'payload.content'?: string;
  'payload.navigateParams'?: LadipageJsonObject;
  'payload.navigateScreen'?: string;
  'payload.pipeline_id'?: unknown | null;
  'payload.redirect'?: string;
  'payload.title'?: string;
  'pipeline_id'?: unknown | null;
  'pipeline_name'?: unknown | null;
  'redirect'?: string;
  'title'?: string;
  'type'?: string;
  'updated_at'?: string;
  'user_id'?: string;
}
