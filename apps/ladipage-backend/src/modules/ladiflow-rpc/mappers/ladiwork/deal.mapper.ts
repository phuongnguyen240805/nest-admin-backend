import type { LpCrmDeal } from '@liora/ladipage-types';

export function mapLadiworkDealRpcItem(value: Record<string, unknown>): LpCrmDeal {
  if ('_id' in value) return clone(value) as LpCrmDeal;

  const customer = objectValue(value.customer);
  return {
    _id: stringValue(value.externalId),
    position: numberValue(value.position),
    status: stringValue(value.status),
    total_value: numberValue(value.totalValue),
    scope_users: arrayValue(value.scopeUsers),
    labels: arrayValue(value.labels),
    activity_status: stringValue(value.activityStatus),
    weighted_value: numberValue(value.weightedValue),
    priority: numberValue(value.priority),
    title: stringValue(value.title),
    pipeline_id: stringValue(value.pipelineId),
    pipeline_stage_id: stringValue(value.pipelineStageId),
    expected_close_date: dateValue(value.expectedCloseDate),
    customer_id: stringValue(value.customerId),
    customer: customer as never,
    'customer.name': stringValue(customer.name ?? value.customerName),
    identity_id: numberValue(value.identityId),
    created_at: dateValue(value.createdAt),
    stage_probability: numberValue(value.stageProbability),
    final_probability: numberValue(value.finalProbability),
    total_deal_notes: numberValue(value.totalDealNotes),
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

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function dateValue(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
