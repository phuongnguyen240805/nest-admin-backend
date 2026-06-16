import { HttpStatus, UnprocessableEntityException, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
} from "@liora/nest-core";
import { CommonEntity } from "@liora/database";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyApp,
    {
      bufferLogs: true,
    }
  );

  // class-validator DI
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
    exclude: ["health", "readyz", ""],
  });

  // Shutdown Hooks in Prod
  if (!isDev) {
    app.enableShutdownHooks();
  }

  // Interceptors
  if (isDev) {
    app.useGlobalInterceptors(new LoggingInterceptor());
  }

  // Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: { enableImplicitConversion: true },
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

  // WebSockets Redis Adapter
  app.useWebSocketAdapter(new RedisIoAdapter(app));

  // Swagger UI Setup for Liora NestAdmin
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Liora NestAdmin API")
    .setDescription(`
      🔷 **Base URL**: \`/api\` <br>
      📌 Liora NestJS Admin Platform API Documentation.
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

  const port = process.env.PORT ?? 7001;
  await app.listen(port, "0.0.0.0");
  console.log(`Liora NestAdmin service running on port ${port}`);
  console.log(`Swagger UI: http://localhost:${port}/docs`);
}

void bootstrap();
