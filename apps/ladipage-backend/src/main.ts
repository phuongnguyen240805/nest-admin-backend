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
  TenantInterceptor,
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
    exclude: ["health", "readyz", "", "v1/public/(.*)"],
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
  app.useGlobalInterceptors(new TenantInterceptor());

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
      🔷 **Base URL**: \`/api\` <br>
      📌 LadiPage / Liora Landing Page Builder Backend.<br><br>
      Tái sử dụng mạnh mẽ từ <b>@liora/nest-core</b> (Auth, Tenant, Billing/Credit/Plan/Stripe, File Manager, SSE/Socket, Agent/AI...).
    `)
    .setVersion("1.0")
    .addServer(`/api`, "Base URL")
    .addSecurity(API_SECURITY_AUTH, {
      description: "Enter Bearer JWT Token",
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

  const port = process.env.PORT ?? 7101;

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
