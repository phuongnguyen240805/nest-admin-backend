import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { resolveWorkspaceEnvPaths } from '@liora/shared'
import { LibrefangConfig } from '@liora/librefang-client'
import { SupabaseConfig } from '@liora/supabase'
import config from '@liora/nest-core/config'
import { BullMqModule } from '@liora/nest-core'

import {
  buildLadipageBullMqOptions,
  isBullMqEnabled,
} from '../config/bullmq.app.config'
import { AiSeoLighthouseWorkerModule } from '../modules/ai-seo/ai-seo-lighthouse-worker.module'
import { LandingAiWorkerModule } from '../modules/landing-ai/landing-ai-worker.module'
import { AdsPlatformWorkerModule } from '../modules/ads-platform/ads-platform-worker.module'

import { WorkerDatabaseModule } from '../database/worker-database.module'

const bullMqImports = isBullMqEnabled()
  ? [
      BullMqModule.forWorker(buildLadipageBullMqOptions()),
      LandingAiWorkerModule,
      AiSeoLighthouseWorkerModule,
      AdsPlatformWorkerModule,
    ]
  : []
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      envFilePath: resolveWorkspaceEnvPaths('ladipage-backend'),
      load: [...Object.values(config), LibrefangConfig, SupabaseConfig],
    }),
    WorkerDatabaseModule,
    ...bullMqImports,
  ],
})
export class WorkerAppModule {}
