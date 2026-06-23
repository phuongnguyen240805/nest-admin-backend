import { Injectable, NotImplementedException } from '@nestjs/common';

export interface RpcContext {
  host?: string;
  path?: string;
}

export type RpcHandler = (
  body: Record<string, unknown>,
  ctx: RpcContext,
) => Promise<unknown> | unknown;

const TODO_ROUTES = new Set([
  'application/list',
  'asset-list',
  'checkout-config/list',
  'checkout/list',
  'custom-field/list',
  'customer/show',
  'data-form-error/list',
  'domain/list',
  'filter/list',
  'form-config/list',
  'inventory/list',
  'ladi-page-tag/list',
  'ladi-page/list',
  'ladi-page/show',
  'list-show-case',
  'order-history/list',
  'order-tag/list',
  'order-tag/list-all',
  'order/list-order',
  'order/show',
  'page-checkout/list-store',
  'payment/list-gateways',
  'product-category/list',
  'product-category/list-select',
  'product-review/list',
  'product-tag/list',
  'product-tag/list-all',
  'product/list-products',
  'product/search',
  'product/show',
  'shipping/list',
  'staff/list',
  'store/get-user-info',
  'store/info',
  'theme-list',
  'theme-tag-list',
]);

@Injectable()
export class RpcDispatcherService {
  private readonly handlers: Record<string, RpcHandler> = {};

  async dispatch(
    resource: string,
    action: string | undefined,
    body: Record<string, unknown>,
    ctx: RpcContext,
  ): Promise<unknown> {
    const routeKey = this.routeKey(resource, action);
    const handler = this.handlers[routeKey];

    if (!handler) {
      const suffix = TODO_ROUTES.has(routeKey)
        ? ' TODO(PR-03): wire this route to a CDP-backed service and mapper.'
        : ' TODO: add a CDP-backed handler before returning production-shaped data.';
      throw new NotImplementedException(`LadiPage RPC route "${routeKey}" is not implemented.${suffix}`);
    }

    return handler(body, ctx);
  }

  private routeKey(resource: string, action: string | undefined): string {
    return action ? `${resource}/${action}` : resource;
  }
}
