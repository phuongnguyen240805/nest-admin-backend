import { HttpStatus, UnprocessableEntityException, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module.js";

function validateEnv() {
  if (!process.env.SYNC_TOKEN && !process.env.SYNC_JWT_PUBLIC_KEY) {
    console.error("Either SYNC_TOKEN or SYNC_JWT_PUBLIC_KEY must be set");
    process.exit(1);
  }
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Enable CORS
  app.enableCors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  });

  // Global Prefix for API endpoints
  app.setGlobalPrefix("api", {
    exclude: ["v1/objects/(.*)", "health", "readyz", ""],
  });

  // Stripe webhook raw body (for signature verification).
  // When using the billing webhook (provided by nest-core BillingModule + StripeWebhookModule),
  // attach raw body for routes starting with /api/webhooks/stripe (or the path configured in the controller).
  // Example using body-parser (already transitive via express platform):
  // import * as bodyParser from 'body-parser';
  // app.use(
  //   bodyParser.json({
  //     verify: (req: any, res, buf: Buffer) => {
  //       if (req.originalUrl?.includes('/webhooks/stripe')) {
  //         req.rawBody = buf;
  //       }
  //     },
  //   }),
  // );

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

  // Swagger UI Setup (Documents ONLY the Donut Sync API)
  const swaggerConfig = new DocumentBuilder()
    .setTitle("Donut Sync API")
    .setDescription(`
      🔷 **Base URL**: \`/api\` <br>
      📌 Donut Sync Backend API Documentation.
    `)
    .setVersion("1.0")
    .addServer(`/api`, "Base URL")
    .addSecurity("bearer", {
      description: "Enter Bearer JWT Token or Sync Token",
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    jsonDocumentUrl: "/docs/json",
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, "0.0.0.0");
  console.log(`Donut Sync service running on port ${port}`);
  console.log(`Swagger UI: http://localhost:${port}/docs`);
}

void bootstrap();
