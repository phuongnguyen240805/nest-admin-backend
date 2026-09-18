import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { resolveWorkspaceEnvPaths } from '@liora/shared'
import { LibrefangConfig } from '@liora/librefang-client'
import { SupabaseConfig } from '@liora/supabase'
import config from '@liora/nest-core/config'
import { BullMqModule, SharedModule } from '@liora/nest-core'

import {
  buildLadipageBullMqOptions,
  isBullMqEnabled,
} from '../config/bullmq.app.config'
import { LandingAiWorkerModule } from '../modules/landing-ai/landing-ai-worker.module'
import { AdsPlatformWorkerModule } from '../modules/ads-platform/ads-platform-worker.module'
import { AutomationWorkerModule } from '../modules/automation/automation-worker.module'
import { PublishWorkerModule } from '../modules/publish/publish-worker.module'

import { WorkerDatabaseModule } from '../database/worker-database.module'

const bullMqImports = isBullMqEnabled()
  ? [
      // Worker modules transitively pull Auth/User/Menu providers. These rely on
      // global infrastructure exported by SharedModule (Redis, Helper/QQ, Mailer,
      // Http, Logger, Scheduler, ...). A worker is a separate Nest app context, so
      // the HTTP app's global SharedModule does not exist here.
      SharedModule,
      BullMqModule.forWorker(buildLadipageBullMqOptions()),
      LandingAiWorkerModule,
      AdsPlatformWorkerModule,
      AutomationWorkerModule,
      PublishWorkerModule,
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
