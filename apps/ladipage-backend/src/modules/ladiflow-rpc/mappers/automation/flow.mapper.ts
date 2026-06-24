import type { LpFlow } from '@liora/ladipage-types';

export function mapAutomationFlowRpcItem(value: LpFlow): LpFlow {
  // TODO(PR-BC-09): replace identity mapping with FlowEntity -> CDP flow item/detail.
  return value;
}
