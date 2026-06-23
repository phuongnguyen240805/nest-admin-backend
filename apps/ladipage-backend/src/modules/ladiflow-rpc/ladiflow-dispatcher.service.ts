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
  'crm-insight-folder/list',
  'crm-organization/list',
  'custom-field/list-all',
  'customer-tag/list',
  'customer-tag/list-all',
  'customer/activity',
  'customer/customer-detail',
  'customer/list',
  'customer/list-customer-merge',
  'customer/show',
  'dash-board/list-subscriber-by-time',
  'ladipage-notification/list',
  'progress-bar/list-sections-latest',
  'segment/list',
]);

@Injectable()
export class LadiflowDispatcherService {
  private readonly handlers: Record<string, LadiflowRpcHandler> = {};

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
