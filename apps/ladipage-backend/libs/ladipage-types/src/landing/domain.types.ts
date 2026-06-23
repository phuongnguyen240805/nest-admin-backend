/* eslint-disable */
// Generated from tools/cdp-reverse-engineer/output/merged/schema-tables-merged.json.
// Do not add fields by hand; update CDP artifacts and rerun export:ts-types.

import type { LadipageJsonObject } from '../common';

/**
 * Source routes:
 * - POST apiv5.ladipage.com/2.0/domain/list
 */
export interface LpDomain {
  '_id'?: string;
  'domain'?: string;
  'is_default'?: boolean;
  'is_delete'?: boolean;
  'is_hidden'?: boolean;
  'is_preview'?: boolean;
  'is_ssl'?: boolean;
  'is_subdomain'?: boolean;
  'is_verified'?: boolean;
  'publish_platform'?: string;
  'status'?: boolean;
  'subdomain_default'?: string;
}
