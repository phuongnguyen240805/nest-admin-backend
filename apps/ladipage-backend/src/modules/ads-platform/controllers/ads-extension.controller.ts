import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Public } from '@liora/nest-core'

import { IngestBrowserSnapshotDto } from '../dto/ads-platform.dto'
import { AdsExtensionSessionGuard } from '../guards/ads-extension-session.guard'
import { AdsBrowserSnapshotService } from '../services/ads-browser-snapshot.service'

@ApiTags('Ads Platform Extension')
@Public()
@UseGuards(AdsExtensionSessionGuard)
@Controller('ads-platform/extension')
export class AdsExtensionController {
  constructor(private readonly browserSnapshots: AdsBrowserSnapshotService) {}

  @Post('snapshots')
  ingestBrowserSnapshot(
    @Body() dto: IngestBrowserSnapshotDto,
    @Req() request: { user?: Record<string, unknown> },
  ) {
    return this.browserSnapshots.ingest(dto, String(request.user?.id ?? ''))
  }
}

