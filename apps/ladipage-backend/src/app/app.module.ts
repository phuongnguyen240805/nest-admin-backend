import { ClassSerializerInterceptor, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";
import { ClsModule } from "nestjs-cls";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

import { resolveWorkspaceEnvPaths } from "@liora/shared";
import { DatabaseModule } from "@liora/database";
import { LibrefangConfig } from "@liora/librefang-client";
import { SupabaseConfig } from "@liora/supabase";
import config from "@liora/nest-core/config";

import {
  // Core infrastructure (tái sử dụng cao từ nest-core)
  SharedModule,
  TenantModule,
  AuthModule,
  TasksModule,
  ToolsModule,
  SocketModule,
  HealthModule,
  SseModule,
  NetdiskModule,
  BillingModule,
  AgentModule,
  PublicApiModule,

  // Global cross-cutting
  AllExceptionsFilter,
  TransformInterceptor,
  TimeoutInterceptor,
  IdempotenceInterceptor,
  JwtAuthGuard,
  RbacGuard,
  TenantInterceptor,
} from "@liora/nest-core";

// =====================================================
// DOMAIN MODULES CỦA LADIPAGE (tái sử dụng nest-core + logic riêng)
// =====================================================
import { FunnelxModule } from '../modules/funnelx/funnelx.module';
import { WebsiteModule } from '../modules/website/website.module';
import { CrmModule } from '../modules/crm/crm.module';
import { EcomStoreModule } from '../modules/ecom-store/ecom-store.module';
import { DomainModule } from '../modules/domain/domain.module';
import { PublishModule } from '../modules/publish/publish.module';
import { CreditModule } from '../modules/credit/credit.module';
import { PlanModule } from '../modules/plan/plan.module';
import { PaymentModule } from '../modules/payment/payment.module';
import { FileManagerModule } from '../modules/file-manager/file-manager.module';
import { BuilderBridgeModule } from '../modules/builder-bridge/builder-bridge.module';
import { FlowiseModule } from '../modules/flowise/flowise.module';
import { SdkModule } from '../modules/sdk/sdk.module';
import { SettingsModule } from '../modules/settings/settings.module';
import { AnalyticsModule } from '../modules/analytics/analytics.module';
import { DashboardModule } from '../modules/dashboard/dashboard.module';
import { LadipageRpcModule } from '../modules/ladipage-rpc/ladipage-rpc.module';
import { LadiflowRpcModule } from '../modules/ladiflow-rpc/ladiflow-rpc.module';
import { LadiflowV5RpcModule } from '../modules/ladiflow-v5-rpc/ladiflow-v5-rpc.module';
import { LadiworkModule } from '../modules/ladiwork/ladiwork.module';
import { AutomationModule } from '../modules/automation/automation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      ignoreEnvFile: process.env.NODE_ENV === "production",
      envFilePath: resolveWorkspaceEnvPaths("ladipage-backend"),
      load: [...Object.values(config), LibrefangConfig, SupabaseConfig],
    }),
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
      },
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

    // === NEST-CORE REUSABLE STACK ===
    SharedModule,        // Redis, Mailer, Logger, Scheduler, Throttler, EventEmitter...
    DatabaseModule,      // TypeORM + constraints
    TenantModule,        // Multi-tenant / workspace (dùng sau cho team)
    AuthModule,          // JWT + RBAC + Captcha + (sau hybrid Supabase)
    TasksModule.forRoot(),
    ToolsModule,         // Upload + Email + Storage (file-manager sẽ wrap)
    SocketModule,
    HealthModule,
    SseModule,           // Realtime (publish status, collab...)
    NetdiskModule,       // File management cao cấp
    BillingModule,       // Subscription + CreditWallet + Organization + Stripe (plan/credit/payment)
    AgentModule,         // AI agents (có thể extend cho Flowise / builder AI)
    PublicApiModule,     // Public/Embed endpoints + quota check

    // === LADIPAGE DOMAIN MODULES (đã import sẵn skeleton) ===
    FunnelxModule,
    WebsiteModule,
    CrmModule,
    EcomStoreModule,
    DomainModule,
    PublishModule,
    CreditModule,
    PlanModule,
    PaymentModule,
    FileManagerModule,
    BuilderBridgeModule,
    FlowiseModule,
    SdkModule,
    SettingsModule,
    AnalyticsModule,
    DashboardModule,
    LadiworkModule,
    AutomationModule,
    LadipageRpcModule,
    LadiflowRpcModule,
    LadiflowV5RpcModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global Exception Filter - Giai đoạn 1 Foundation requirement
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
    { provide: APP_INTERCEPTOR, useExisting: TenantInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useFactory: () => new TimeoutInterceptor(15 * 1000) },
    { provide: APP_INTERCEPTOR, useClass: IdempotenceInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
