import { BadRequestException, Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import type { FastifyRequest } from 'fastify'

import { Public } from '@liora/nest-core'
import { Bypass } from '@liora/nest-core/common/decorators/bypass.decorator'

import { SepayWebhookDto } from '../dto/sepay-webhook.dto'
import { SepayWebhookAuthService } from '../providers/sepay/sepay-webhook-auth.service'
import { SepayWebhookService } from '../services/sepay-webhook.service'

@Public()
@SkipThrottle()
@Controller('internal/payments/sepay')
export class SepayWebhookController {
  constructor(
    private readonly auth: SepayWebhookAuthService,
    private readonly service: SepayWebhookService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @Bypass()
  async webhook(
    @Req() req: FastifyRequest & { rawBody?: string | Buffer },
    @Headers('x-sepay-timestamp') timestamp: string,
    @Headers('x-sepay-signature') signature: string,
    @Body() dto: SepayWebhookDto,
  ) {
    if (req.rawBody == null) {
      throw new BadRequestException('Raw request body is required for SePay signature verification')
    }
    const rawBody = typeof req.rawBody === 'string'
      ? req.rawBody
      : Buffer.isBuffer(req.rawBody)
        ? req.rawBody.toString('utf8')
        : ''
    this.auth.verify(rawBody, timestamp ?? '', signature ?? '')
    await this.service.process(dto)
    return { success: true }
  }
}
