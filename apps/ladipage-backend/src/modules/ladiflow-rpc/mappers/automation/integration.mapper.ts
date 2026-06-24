import type { LpIntegration } from '@liora/ladipage-types';

export function mapAutomationIntegrationRpcItem(value: LpIntegration): LpIntegration {
  // TODO(PR-BC-10): replace identity mapping with IntegrationEntity -> CDP integration item.
  return value;
}
