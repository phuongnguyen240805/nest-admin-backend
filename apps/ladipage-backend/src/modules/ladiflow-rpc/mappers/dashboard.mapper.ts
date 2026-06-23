export interface DashboardSubscriberPoint {
  label: string;
  value: number;
}

export function mapSubscriberSeries(points: DashboardSubscriberPoint[]): { items: DashboardSubscriberPoint[] } {
  // TODO(PR-P34-11): align this fallback with dash-board/list-subscriber-by-time CDP fixture.
  return { items: points };
}
