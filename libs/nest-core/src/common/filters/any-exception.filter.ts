import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { FastifyReply, FastifyRequest } from 'fastify'
import { QueryFailedError } from 'typeorm'

import { BusinessException } from '~/common/exceptions/biz.exception'
import { ErrorEnum } from '~/constants/error-code.constant'

import { isDev } from '~/global/env'
import { ErrorResponseDto } from '../dto/response.dto'

interface myError {
  readonly status: number
  readonly statusCode?: number

  readonly message?: string
}

/**
 * AllExceptionsFilter - Global exception handler (Giai đoạn 1 Foundation)
 *
 * Catches ALL exceptions and returns a consistent error shape:
 * {
 *   code: number,
 *   message: string,
 *   data: null,
 *   error?: any   // only in development
 * }
 *
 * This guarantees that every API (Funnel, Publish, Credit...) returns predictable errors.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  constructor() {
    this.registerCatchAllExceptionsHook()
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<FastifyRequest>()
    const response = ctx.getResponse<FastifyReply>()

    const url = request.raw.url!

    const status = this.getStatus(exception)
    let message = this.getErrorMessage(exception)

    // System internal error
    if (
      status === HttpStatus.INTERNAL_SERVER_ERROR
      && !(exception instanceof BusinessException)
    ) {
      Logger.error(exception, undefined, 'Catch')

      if (!isDev) {
        message = ErrorEnum.SERVER_ERROR?.split(':')[1] || 'Internal Server Error'
      }
    } else {
      this.logger.warn(
        `Error: (${status}) ${message} | Path: ${decodeURI(url)}`,
      )
    }

    const apiErrorCode = exception instanceof BusinessException 
      ? exception.getErrorCode() 
      : status

    const errorResponse = new ErrorResponseDto();
    errorResponse.code = apiErrorCode;
    errorResponse.message = message;

    if (isDev && exception instanceof Error) {
      (errorResponse as any).error = {
        stack: exception.stack,
        name: exception.name,
      };
    }

    response.status(status).send(errorResponse);
  }

  getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus()
    }
    else if (exception instanceof QueryFailedError) {
      // console.log('driverError', exception.driverError.code)
      return HttpStatus.INTERNAL_SERVER_ERROR
    }
    else {
      return (exception as myError)?.status
        ?? (exception as myError)?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR
    }
  }

  getErrorMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      return exception.message
    }
    else if (exception instanceof QueryFailedError) {
      return exception.message
    }

    else {
      return (exception as any)?.response?.message ?? (exception as myError)?.message ?? `${exception}`
    }
  }

  registerCatchAllExceptionsHook() {
    process.on('unhandledRejection', (reason) => {
      console.error('unhandledRejection: ', reason)
    })

    process.on('uncaughtException', (err) => {
      console.error('uncaughtException: ', err)
    })
  }
}
