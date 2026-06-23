import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

export interface LadiflowContext {
  ownerId?: string;
  authorization?: string;
}

type LadiflowRequest = FastifyRequest & {
  ladiflowContext?: LadiflowContext;
};

@Injectable()
export class LadiflowContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<LadiflowRequest>();
    request.ladiflowContext = {
      ownerId: this.headerValue(request, 'owner-id'),
      authorization: this.headerValue(request, 'authorization'),
    };
    // TODO(PR-P34-03): validate owner-id against tenant external mapping once that table exists.
    return true;
  }

  private headerValue(request: FastifyRequest, key: string): string | undefined {
    const value = request.headers[key];
    return Array.isArray(value) ? value[0] : value;
  }
}
