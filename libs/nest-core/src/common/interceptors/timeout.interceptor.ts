import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable, throwError, TimeoutError } from 'rxjs'
import { catchError, timeout } from 'rxjs/operators'
import { REQUEST_TIMEOUT_MS_KEY } from '../decorators/timeout.decorator'

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(
    private readonly time: number = 10000,
    private readonly reflector?: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const routeTimeout = this.reflector?.getAllAndOverride<number>(REQUEST_TIMEOUT_MS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    const timeoutMs = Number.isFinite(routeTimeout) && routeTimeout! > 0 ? routeTimeout! : this.time
    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError)
          return throwError(() => new RequestTimeoutException('请求超时'))

        return throwError(() => err)
      }),
    )
  }
}
