import type { LpCrmPipeline } from '@liora/ladipage-types';

export function mapLadiworkPipelineRpcItem(value: Record<string, unknown>): LpCrmPipeline {
  return JSON.parse(JSON.stringify(value)) as LpCrmPipeline;
}
