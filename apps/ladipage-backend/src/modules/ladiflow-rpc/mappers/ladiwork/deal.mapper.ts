import type { LpCrmDeal } from '@liora/ladipage-types';

export function mapLadiworkDealRpcItem(value: Record<string, unknown>): LpCrmDeal {
  return JSON.parse(JSON.stringify(value)) as LpCrmDeal;
}
