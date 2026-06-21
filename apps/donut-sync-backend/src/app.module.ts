import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { resolveWorkspaceEnvPaths } from "@liora/shared";

import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { SyncModule } from "./sync/sync.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      ignoreEnvFile: process.env.NODE_ENV === "production",
      envFilePath: resolveWorkspaceEnvPaths("donut-sync-backend"),
    }),
    SyncModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
  ],
})
export class AppModule {}
