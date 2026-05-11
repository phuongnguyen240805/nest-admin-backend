import type { ExecutionContext } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { createParamDecorator } from '@nestjs/common'

export const Cookies = createParamDecorator((data: string, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest & { cookies?: Record<string, string> }>()
  return data ? request.cookies?.[data] : request.cookies
})
