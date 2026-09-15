import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { LibrefangConfig } from '@liora/librefang-client'
import { BullMqModule } from '@liora/nest-core'
import config from '@liora/nest-core/config'
import { resolveWorkspaceEnvPaths } from '@liora/shared'
import { SupabaseConfig } from '@liora/supabase'

import {
  buildLadipageBullMqOptions,
  isBullMqEnabled,
} from '../config/bullmq.app.config'
import { WorkerDatabaseModule } from '../database/worker-database.module'
import { AiSeoLighthouseWorkerModule } from '../modules/ai-seo/ai-seo-lighthouse-worker.module'

const workerImports = isBullMqEnabled()
  ? [
      BullMqModule.forWorker(buildLadipageBullMqOptions()),
      AiSeoLighthouseWorkerModule,
    ]
  : []

/** Chromium/Unlighthouse processors only. Keep this runtime isolated from API/general workers. */
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
    ...workerImports,
  ],
})
export class BrowserWorkerAppModule {}
