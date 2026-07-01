/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST api.ladipage.com/2.0/application/list
 */
export interface LpApplication {
  '_id'?: string;
  'code'?: string;
  'created_at'?: string;
  'is_delete'?: boolean;
  'ladi_uid'?: string;
  'logo'?: string;
  'name'?: string;
  'owner_id'?: string;
  'permission'?: string;
  'price'?: number;
  'required_tier'?: 'free' | 'pro' | 'enterprise';
  'status_active'?: boolean;
  'status_actived_at'?: string;
  'status_pin'?: boolean;
  'store_id'?: string;
  'thumb'?: string;
  'updated_at'?: string;
  'views_count'?: number;
  'installs_count'?: number;
  'can_install'?: boolean;
  'can_open'?: boolean;
  'upgrade_required'?: boolean;
}
