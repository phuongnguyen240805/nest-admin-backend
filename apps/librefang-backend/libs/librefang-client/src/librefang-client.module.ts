import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { LibrefangConfig } from './librefang.config'
import { LibrefangService } from './librefang.service'

@Module({
  imports: [
    HttpModule.register({
      timeout: 120_000,
      maxRedirects: 5,
    }),
    ConfigModule.forFeature(LibrefangConfig),
  ],
  providers: [LibrefangService],
  exports: [LibrefangService, HttpModule, ConfigModule],
})
export class LibrefangClientModule {}
