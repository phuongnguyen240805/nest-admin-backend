import type { LpAnalyticsReport } from '@liora/ladipage-types';

export function mapAnalyticsReportRpcItem(value: Record<string, unknown>): LpAnalyticsReport {
  if ('product_id' in value || 'source' in value && !('productId' in value)) {
    return clone(value) as LpAnalyticsReport;
  }

  return {
    product_type: stringValue(value.productType),
    up_sell_ids: nullableValue(value.upSellIds),
    restock: numberValue(value.restock),
    product_id: numberValue(value.productId),
    name: stringValue(value.name),
    quantity: numberValue(value.quantity),
    total: numberValue(value.total),
    source: stringValue(value.source),
    refund: nullableValue(value.refund),
    num_order: numberValue(value.numOrder),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T;
}

function stringValue(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

function nullableValue(value: unknown): unknown | null {
  return value == null ? null : value;
}

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
