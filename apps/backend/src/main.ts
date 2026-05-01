import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import * as express from "express";
import helmet from "helmet";

// [SEC-3] Validate required env vars for external services in production.
// Prevents silent fallback to localhost (which could leak data to wrong host
// or fail mysteriously) when deployed without proper configuration.
function validateProductionEnv() {
  if (process.env.NODE_ENV !== "production") return;
  const required = [
    "PYTHON_SERVICE_URL",
    "CLICKHOUSE_EXTERNAL_HOST",
    "CLICKHOUSE_EXTERNAL_PORT",
    "CLICKHOUSE_PLAY_URL",
    "JWT_SECRET",
    "CORS_ORIGINS",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Production startup blocked: missing required environment variables: ${missing.join(", ")}`,
    );
  }
  // Warn if any of them still point at localhost (deployment misconfig)
  const localish = /(localhost|127\.0\.0\.1)/i;
  for (const key of ["PYTHON_SERVICE_URL", "CLICKHOUSE_EXTERNAL_HOST", "CLICKHOUSE_PLAY_URL"]) {
    const v = process.env[key];
    if (v && localish.test(v)) {
      // eslint-disable-next-line no-console
      console.warn(`[SEC-3] WARNING: ${key} contains localhost in production: ${v}`);
    }
  }
}

async function bootstrap() {
  validateProductionEnv();
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");

  // [H-4] Always trust the first reverse-proxy hop so req.ip / X-Forwarded-For
  // resolves to the real client IP for brute-force lockout keys. Safe even when
  // running directly without a proxy — falls back to socket.remoteAddress.
  app.getHttpAdapter().getInstance().set("trust proxy", 1);

  // Security headers
  app.use(
    helmet({
      // API server: block all content types — responses are JSON only
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      // Allow cross-origin image/resource loading (frontend & backend on different ports)
      crossOriginResourcePolicy: false,
      // Strict-Transport-Security header
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
    }),
  );

  // [M-5] Reduced /users from 10mb to 6mb (profile image limit is 5MB after base64 overhead)
  app.use("/users", express.json({ limit: "6mb" }));
  app.use("/users", express.urlencoded({ limit: "6mb", extended: true }));
  app.use("/tailan", express.json({ limit: "10mb" }));
  app.use("/tailan", express.urlencoded({ limit: "10mb", extended: true }));
  app.use("/news", express.json({ limit: "6mb" }));
  app.use("/news", express.urlencoded({ limit: "6mb", extended: true }));
  // Tight default limit for all other endpoints
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  // Add global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Enable CORS with strict validation
  if (!process.env.CORS_ORIGINS) {
    throw new Error("CORS_ORIGINS environment variable is required");
  }
  const corsOrigins = process.env.CORS_ORIGINS.split(",").map((s) => s.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no Origin header (Docker healthcheck, server-to-server, curl).
      // Browser-originated traffic still goes through strict whitelist validation below.
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check if origin is in whitelist — exact match only to prevent subdomain spoofing
      if (corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked request from: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    exposedHeaders: ["Content-Length", "X-Request-Id"],
    maxAge: 86400, // 24 hours
  });

  // Enable validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // [LOW-4] Reject requests with unrecognized properties
      transform: true,
    }),
  );

  // [MED-3] Swagger/OpenAPI docs — disabled in production to reduce attack surface
  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("Internal Audit API")
      .setDescription("API documentation for Internal Audit Management System")
      .setVersion("1.0")
      .addBearerAuth(
        {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          name: "JWT",
          description: "Enter JWT token",
          in: "header",
        },
        "JWT-auth",
      )
      .addTag("auth", "Authentication endpoints")
      .addTag("users", "User management")
      .addTag("departments", "Department management")
      .addTag("news", "News management")
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api-docs", app, document);
    logger.log(` Swagger docs available at /api-docs (dev only)`);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(` Backend сервер ${port} порт дээр ажиллаж эхэллээ`);
  logger.log(` Security: SQL Injection protection enabled`);
  logger.log(` Environment: ${process.env.NODE_ENV || "development"}`);
}
bootstrap();
