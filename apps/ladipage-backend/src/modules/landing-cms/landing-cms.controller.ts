import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'

import { API_SECURITY_AUTH, Public, TenantGuard } from '@liora/nest-core'
import { AuthUser } from '@liora/nest-core/modules/auth/decorators/auth-user.decorator'

import { LandingPageService } from './application/landing-page.service'
import {
  MaterializeHtmlDto,
  OpenEditorSessionDto,
} from './dto/open-editor-session.dto'

/**
 * Public readiness for Instatic adapter (no JWT).
 * Use this instead of GET /api/health (that route does not exist → Nest 404).
 */
@ApiTags('Landing CMS')
@SkipThrottle()
@Public()
@Controller('landing-cms')
export class LandingCmsHealthController {
  constructor(private readonly landingPageService: LandingPageService) {}

  @Get('health')
  @ApiOperation({ summary: 'Instatic adapter health (mock or live) — public probe' })
  health() {
    return this.landingPageService.runtimeHealth()
  }
}

@ApiTags('Landing CMS')
@ApiSecurity(API_SECURITY_AUTH)
@SkipThrottle()
@UseGuards(TenantGuard)
@Controller('landing-cms')
export class LandingCmsController {
  constructor(private readonly landingPageService: LandingPageService) {}

  @Post('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mint Instatic editor session + same-origin CMS path' })
  openSession(@Body() dto: OpenEditorSessionDto, @AuthUser('uid') uid: number) {
    return this.landingPageService.openEditorSession(dto.pageId, uid)
  }

  @Post('materialize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Import HTML into Instatic (AI Generator / Clone URL post-job)' })
  materialize(@Body() dto: MaterializeHtmlDto, @AuthUser('uid') uid: number) {
    return this.landingPageService.materializeFromHtml({
      pageId: dto.pageId,
      html: dto.html,
      name: dto.name,
      slug: dto.slug,
      workspaceId: dto.workspaceId,
      actorUserId: uid,
    })
  }

  @Get('pages/:pageId/artifact')
  @ApiOperation({ summary: 'Fetch published HTML artifact from Instatic mapping' })
  getArtifact(@Param('pageId') pageId: string, @AuthUser('uid') _uid: number) {
    return this.landingPageService.getPublishedArtifact(pageId)
  }
}
