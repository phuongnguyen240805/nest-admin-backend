import type { LpLadiworkDashboard } from '@liora/ladipage-types';

export function mapLadiworkDashboardRpcItem(value: Record<string, unknown>): LpLadiworkDashboard {
  return JSON.parse(JSON.stringify(value)) as LpLadiworkDashboard;
}
