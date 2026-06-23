import type { LpPage } from '@liora/ladipage-types';

export function mapLandingPageRpcItem(value: LpPage): LpPage {
  // TODO(PR-03): replace identity mapping with entity -> CDP field mapping after lp_page entity lands.
  return value;
}
