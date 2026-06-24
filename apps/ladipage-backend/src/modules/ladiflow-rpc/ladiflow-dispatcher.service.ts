import { Injectable, NotImplementedException } from '@nestjs/common';

export interface LadiflowRpcContext {
  ownerId?: string;
  authorization?: string;
  host?: string;
  path?: string;
}

export type LadiflowRpcHandler = (
  body: Record<string, unknown>,
  ctx: LadiflowRpcContext,
) => Promise<unknown> | unknown;

const TODO_ROUTES = new Set([
  'broadcast/list',
  'call-center/list-integrations',
  'crm-deal-custom-field/list',
  'crm-deal/get-summary',
  'crm-deal/list',
  'crm-filter/get-system-filters',
  'crm-insight-folder/list',
  'crm-label/list-all',
  'crm-organization/list',
  'crm-pipeline-category/list',
  'crm-pipeline/list',
  'crm-pipeline/search',
  'crm-staff-configuration/get-list-staff-configuration',
  'custom-field/list-all',
  'customer-tag/list',
  'customer-tag/list-all',
  'customer/activity',
  'customer/customer-detail',
  'customer/list',
  'customer/list-customer-merge',
  'customer/show',
  'dash-board/list-subscriber-by-time',
  'flow-tag/list-all',
  'flow/list',
  'integration/list-all',
  'ladipage-notification/list',
  'ladiwork-dashboard/attention-stats',
  'ladiwork-dashboard/config',
  'ladiwork-dashboard/job-status-stats',
  'ladiwork-dashboard/list-pipelines',
  'ladiwork-dashboard/member-performance',
  'ladiwork-dashboard/pipeline-by-stage',
  'progress-bar/list-sections-latest',
  'segment/list',
]);

@Injectable()
export class LadiflowDispatcherService {
  private readonly handlers: Record<string, LadiflowRpcHandler> = {};

  registerHandler(routeKey: string, handler: LadiflowRpcHandler): void {
    this.handlers[routeKey] = handler;
  }

  async dispatch(
    resource: string,
    action: string,
    body: Record<string, unknown>,
    ctx: LadiflowRpcContext,
  ): Promise<unknown> {
    const routeKey = `${resource}/${action}`;
    const handler = this.handlers[routeKey];

    if (!handler) {
      const suffix = TODO_ROUTES.has(routeKey)
        ? ' TODO(PR-P34-03): wire this Ladiflow route to CRM/dashboard service and CDP mapper.'
        : ' TODO: capture this Ladiflow route before returning production-shaped data.';
      throw new NotImplementedException(`Ladiflow RPC route "${routeKey}" is not implemented.${suffix}`);
    }

    return handler(body, ctx);
  }
}
