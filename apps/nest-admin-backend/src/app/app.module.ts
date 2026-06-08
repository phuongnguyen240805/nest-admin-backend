import { ClassSerializerInterceptor, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";
import { ClsModule } from "nestjs-cls";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

import { DatabaseModule } from "@liora/database";
import { LibrefangConfig } from "@liora/librefang-client";
import { SupabaseConfig } from "@liora/supabase";
import config from "@liora/nest-core/config";
import {
  SharedModule,
  TenantModule,
  AuthModule,
  SystemModule,
  TasksModule,
  ToolsModule,
  SocketModule,
  HealthModule,
  SseModule,
  NetdiskModule,
  BillingModule,
  AgentModule,
  PublicApiModule,
  TodoModule,
  AllExceptionsFilter,
  TransformInterceptor,
  TimeoutInterceptor,
  IdempotenceInterceptor,
  JwtAuthGuard,
  RbacGuard,
} from "@liora/nest-core";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      ignoreEnvFile: process.env.NODE_ENV === "production",
      envFilePath: [".env.local", `.env.${process.env.NODE_ENV}`, ".env"],
      load: [...Object.values(config), LibrefangConfig, SupabaseConfig],
    }),
    ClsModule.forRoot({
      global: true,
      interceptor: {
        mount: true,
        setup: (cls, context) => {
          const req = context.switchToHttp().getRequest();
          if (req.params?.id && req.body) {
            cls.set("operateId", Number.parseInt(req.params.id));
          }
        },
      },
    }),
    SharedModule,
    DatabaseModule,
    TenantModule,
    AuthModule,
    SystemModule,
    TasksModule.forRoot(),
    ToolsModule,
    SocketModule,
    HealthModule,
    SseModule,
    NetdiskModule,
    BillingModule,
    AgentModule,
    PublicApiModule,
    TodoModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useFactory: () => new TimeoutInterceptor(15 * 1000) },
    { provide: APP_INTERCEPTOR, useClass: IdempotenceInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
