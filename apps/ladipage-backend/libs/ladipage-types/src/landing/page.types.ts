/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladipage.com/2.0/ladi-page/list
 * - POST apiv5.ladipage.com/2.0/ladi-page/show
 */
export interface LpPage {
  '_id'?: string;
  'alias'?: string;
  'backup_count'?: number;
  'content_versions'?: unknown[];
  'created_at'?: string;
  'creator_id'?: string;
  'design_type'?: string;
  'domain'?: unknown | null;
  'form_inputs'?: unknown[];
  'https'?: boolean;
  'is_delete'?: boolean;
  'is_publish'?: boolean;
  'last_update_source'?: string;
  'last_update_source_mobile'?: string;
  'name'?: string;
  'origin_id'?: string;
  'owner_id'?: string;
  'page_url'?: unknown | null;
  'path'?: unknown | null;
  'publish_platform'?: string;
  'revenue'?: LadipageJsonObject;
  'revenue.currency'?: string;
  'revenue.total'?: number;
  'scope_teams'?: unknown[];
  'scope_users'?: unknown[];
  'store_id'?: string;
  'subdomain'?: string;
  'tag_ai'?: unknown[];
  'tags'?: unknown[];
  'tracking'?: LadipageJsonObject;
  'tracking.cr'?: number;
  'tracking.last_updated_at'?: string;
  'tracking.total_conversion'?: number;
  'tracking.total_unique_conversion'?: number;
  'tracking.total_unique_visit'?: number;
  'tracking.total_visit'?: number;
  'traking_data'?: string;
  'type'?: string;
  'updated_at'?: string;
  'url'?: unknown | null;
  'user_scopes'?: unknown[];
}
