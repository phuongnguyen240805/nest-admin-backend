import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import type { LadipageRpcResponse } from '@liora/ladipage-types';

const SUCCESS_MESSAGE = 'Th\u00e0nh c\u00f4ng';

function isRpcResponse(value: unknown): value is LadipageRpcResponse<unknown> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LadipageRpcResponse<unknown>>;
  return 'data' in candidate && candidate.code === 200;
}

@Injectable()
export class LadipageRpcResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<LadipageRpcResponse<unknown>> {
    return next.handle().pipe(
      map((value) => {
        if (isRpcResponse(value)) return value;
        return {
          data: value ?? null,
          message: SUCCESS_MESSAGE,
          code: 200,
        };
      }),
    );
  }
}
