export interface DateRange {
  from: Date;
  to: Date;
}

export function parseReportDateRange(from?: string, to?: string): DateRange {
  const now = new Date();
  const end = to ? endOfDay(new Date(to)) : endOfDay(now);
  const start = from
    ? startOfDay(new Date(from))
    : startOfDay(new Date(end.getTime() - 13 * 24 * 60 * 60 * 1000));

  if (start > end) {
    return { from: startOfDay(end), to: endOfDay(start) };
  }

  return { from: start, to: end };
}

export function getPreviousPeriod(range: DateRange): DateRange {
  const durationMs = range.to.getTime() - range.from.getTime();
  const previousTo = new Date(range.from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - durationMs);

  return {
    from: startOfDay(previousFrom),
    to: endOfDay(previousTo),
  };
}

export function buildDailyLabels(range: DateRange): string[] {
  const labels: string[] = [];
  const cursor = startOfDay(range.from);
  const end = startOfDay(range.to);

  while (cursor <= end) {
    labels.push(formatChartLabel(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return labels;
}

export function formatChartLabel(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

export function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildSummary(
  currentTotal: number,
  previousTotal: number,
): { total: number; change: number; changePercent: number } {
  const change = currentTotal - previousTotal;
  const changePercent =
    previousTotal === 0
      ? currentTotal > 0
        ? 100
        : 0
      : Number(((change / previousTotal) * 100).toFixed(1));

  return {
    total: currentTotal,
    change,
    changePercent,
  };
}

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  const day = result.getDay();
  const diff = day === 0 ? 6 : day - 1;
  result.setDate(result.getDate() - diff);
  return result;
}