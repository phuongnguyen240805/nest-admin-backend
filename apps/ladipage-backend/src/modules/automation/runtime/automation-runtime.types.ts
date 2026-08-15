export type RuntimeGraphSchema = 'ladiflow' | 'node-graph' | 'unknown';

export interface RuntimeFlowStep {
  id: string;
  type: string;
  order: number;
  config: Record<string, unknown>;
  source: Record<string, unknown>;
}

export interface RuntimeFlowGraph {
  schema: RuntimeGraphSchema;
  triggers: Record<string, unknown>[];
  steps: RuntimeFlowStep[];
  raw: Record<string, unknown>;
}

export interface FlowGraphValidationResult extends Record<string, unknown> {
  valid: boolean;
  schema: RuntimeGraphSchema;
  errors: string[];
  warnings: string[];
}
