import type { LpLadiworkDashboard } from '@liora/ladipage-types';

export function mapLadiworkDashboardRpcItem(value: Record<string, unknown>): LpLadiworkDashboard {
  if ('_id' in value || 'widgets' in value) return clone(value) as LpLadiworkDashboard;

  return {
    _id: stringValue(value.externalId),
    widget_key: stringValue(value.widgetKey),
    type: stringValue(value.type),
    name: stringValue(value.name),
    visible: booleanValue(value.visible),
    expanded: booleanValue(value.expanded),
    order: numberValue(value.order),
    stage_id: stringValue(value.stageId),
    stage_name: stringValue(value.stageName),
    count: numberValue(value.count),
    total_value: numberValue(value.totalValue),
    stages: Array.isArray(value.stages) ? value.stages : [],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

function stringValue(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
