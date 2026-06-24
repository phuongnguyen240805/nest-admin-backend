import { Injectable, NotImplementedException } from '@nestjs/common';

import type { LadiflowRpcContext, LadiflowRpcHandler } from '../ladiflow-rpc/ladiflow-dispatcher.service';

const TODO_ROUTES = new Set([
  'customer-tag/list-all',
  'flow/show',
  'integration/list-all',
  'recurring-topic/list',
  'segment/list-all',
]);

@Injectable()
export class LadiflowV5DispatcherService {
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
        ? ' TODO(PR-BC-09/11): wire apiv5 Ladiflow editor route to automation/CRM service and CDP mapper.'
        : ' TODO: capture this apiv5 Ladiflow route before returning production-shaped data.';
      throw new NotImplementedException(`Ladiflow v5 RPC route "${routeKey}" is not implemented.${suffix}`);
    }

    return handler(body, ctx);
  }
}
