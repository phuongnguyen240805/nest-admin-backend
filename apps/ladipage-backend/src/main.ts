import { HttpStatus, UnprocessableEntityException, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { useContainer } from "class-validator";

import { AppModule } from "./app/app.module";
import {
  API_SECURITY_AUTH,
  fastifyApp,
  isDev,
  LoggingInterceptor,
  RedisIoAdapter,
  ResOp,
  TreeResult,
  Pagination,
  AllExceptionsFilter, // Global exception filter from foundation
} from "@liora/nest-core";
import { CommonEntity } from "@liora/database";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyApp,
    {
      bufferLogs: true,
      // Professional logger can be injected later via SharedModule + LoggerService (winston)
      // Example: const winstonLogger = app.get(LoggerService); app.useLogger(winstonLogger);
    }
  );

  // class-validator DI (cho custom constraints như @Unique, @EntityExist từ @liora/database)
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Enable CORS
  app.enableCors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  });

  // Global Prefix
  app.setGlobalPrefix("api", {
    exclude: ["health", "readyz", "", "v1/public/(.*)", "2.0/(.*)", "ladiflow/1.0/(.*)"],
  });

  // Shutdown Hooks in Prod
  if (!isDev) {
    app.enableShutdownHooks();
  }

  // ============================================================
  // Global Exception Filter (from Foundation - Giai đoạn 1)
  // ============================================================
  app.useGlobalFilters(new AllExceptionsFilter());

  // Interceptors (global)
  if (isDev) {
    app.useGlobalInterceptors(new LoggingInterceptor());
  }

  // ============================================================
  // Global ValidationPipe - Giai đoạn 1 Foundation requirement
  // ============================================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,                    // Strip unknown properties
      transform: true,                    // Auto transform payloads to DTO classes
      forbidNonWhitelisted: true,         // Throw error if unknown properties are sent
      transformOptions: { enableImplicitConversion: true },
      validationError: { target: false }, // Do not expose the whole DTO in error (security + cleanliness)
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      stopAtFirstError: true,
      exceptionFactory: (errors) =>
        new UnprocessableEntityException(
          errors.map((e) => {
            const rule = Object.keys(e.constraints!)[0];
            const msg = e.constraints![rule];
            return msg;
          })[0]
        ),
    })
  );

  // WebSockets Redis Adapter (hỗ trợ realtime publish status, collab...)
  app.useWebSocketAdapter(new RedisIoAdapter(app));

  // Swagger UI Setup cho LadiPage Backend
  const swaggerConfig = new DocumentBuilder()
    .setTitle("LadiPage Backend API")
    .setDescription(`
      🔷 **Base URL**: \`/api\` · **Swagger**: \`/docs\` · **Port**: 7002 (Docker) <br>
      📌 LadiPage / Liora Landing Page Builder Backend.<br><br>
      **LadiPage domain**: publish, website, funnelx, domain, ecom-store, builder-bridge, flowise, sdk…<br>
      **Tái sử dụng @liora/nest-core**: Auth (JWT + Supabase exchange), Tenant, Billing/Stripe, Credit, Plan, File/Netdisk, SSE/Socket, Agent/AI, System RBAC…
    `)
    .setVersion("1.0")
    .addServer(`/api`, "Base URL")
    .addTag("publish", "LadiPage — Publish landing / embed")
    .addTag("LadiPage", "LadiPage app & health")
    .addTag("Auth - 认证模块", "Đăng ký / exchange Supabase → Nest JWT")
    .addTag("Billing", "Subscription, credit wallet, Stripe")
    .addTag("System - 菜单权限模块", "RBAC menus & permissions")
    .addSecurity(API_SECURITY_AUTH, {
      description: "Bearer JWT từ POST /api/auth/exchange (sau Supabase signIn)",
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    ignoreGlobalPrefix: true,
    extraModels: [CommonEntity, ResOp, Pagination, TreeResult],
  });

  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    jsonDocumentUrl: "/docs/json",
  });

  const port = process.env.LADIPAGE_PORT ?? process.env.PORT ?? 7002;

  // ============================================================
  // Professional Logger Integration (winston via nest-core)
  // Giai đoạn 1 requirement - structured logs + file rotation
  // ============================================================
  // The SharedModule (imported in AppModule) provides advanced winston logging.
  // You can resolve LoggerService and call app.useLogger(...) for full control.
  // For now we rely on bufferLogs + the existing LoggingInterceptor + winston transports.
  // To activate custom logger explicitly:
  //   import { LoggerService } from '@liora/nest-core';
  //   const winstonLogger = app.get(LoggerService);
  //   app.useLogger(winstonLogger);

  await app.listen(port, "0.0.0.0");
  console.log(`🚀 LadiPage Backend running on port ${port}`);
  console.log(`📖 Swagger UI: http://localhost:${port}/docs`);
}

void bootstrap();
