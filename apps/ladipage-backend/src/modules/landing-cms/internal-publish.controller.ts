import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import type { FastifyRequest } from 'fastify'

import { Public } from '@liora/nest-core'

import { LandingPageService } from './application/landing-page.service'
import { PublishIntentDto } from './dto/open-editor-session.dto'

/**
 * HMAC-authenticated endpoint for ladipage-bridge plugin.
 * Must stay @Public() (no JWT) — auth is the bridge signature.
 */
@ApiExcludeController()
@SkipThrottle()
@Public()
@Controller('internal/landing')
export class InternalPublishController {
  constructor(private readonly landingPageService: LandingPageService) {}

  @Post('publish-intent')
  @HttpCode(HttpStatus.OK)
  async publishIntent(
    @Req() req: FastifyRequest & { rawBody?: string | Buffer },
    @Body() dto: PublishIntentDto,
    @Headers('x-lp-timestamp') timestamp: string,
    @Headers('x-lp-signature') signature: string,
  ) {
    if (!timestamp || !signature) {
      throw new UnauthorizedException('Missing bridge signature headers')
    }

    const rawBody =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : Buffer.isBuffer(req.rawBody)
          ? req.rawBody.toString('utf8')
          : JSON.stringify(dto)

    this.landingPageService.verifyBridgeRequest(rawBody, timestamp, signature)
    return this.landingPageService.acceptPublishIntent(dto)
  }
}
