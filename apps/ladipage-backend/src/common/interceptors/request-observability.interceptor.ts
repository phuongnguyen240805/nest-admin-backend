import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import { ClsService } from 'nestjs-cls'
import { randomUUID } from 'node:crypto'
import { Observable, finalize } from 'rxjs'

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/
const TRACEPARENT = /^[\da-f]{2}-([\da-f]{32})-([\da-f]{16})-[\da-f]{2}$/i

function safeRoute(request: any): string {
  const route = request.routeOptions?.url ?? request.routerPath ?? request.route?.path
  if (typeof route === 'string' && route.length <= 512) return route
  const url = typeof request.url === 'string' ? request.url : '/'
  return url.split('?')[0].slice(0, 512)
}

@Injectable()
export class RequestObservabilityInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RequestTrace')

  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<any>()
    const response = context.switchToHttp().getResponse<any>()
    const incomingRequestId = String(request.headers?.['x-request-id'] ?? '')
    const requestId = SAFE_REQUEST_ID.test(incomingRequestId) ? incomingRequestId : randomUUID()
    const traceparent = String(request.headers?.traceparent ?? '')
    const traceId = TRACEPARENT.exec(traceparent)?.[1] ?? requestId
    const started = Date.now()

    this.cls.set('requestId', requestId)
    this.cls.set('traceId', traceId)
    if (typeof response.header === 'function') response.header('x-request-id', requestId)
    else if (typeof response.setHeader === 'function') response.setHeader('x-request-id', requestId)

    return next.handle().pipe(
      finalize(() => {
        const tenantId = this.cls.get('tenantId')
        const userId = request.user?.uid
        this.logger.log(
          JSON.stringify({
            event: 'http_request',
            requestId,
            traceId,
            method: request.method,
            route: safeRoute(request),
            statusCode: response.statusCode,
            durationMs: Date.now() - started,
            ...(tenantId ? { tenantId } : {}),
            ...(userId ? { userId } : {}),
          }),
        )
      }),
    )
  }
}
