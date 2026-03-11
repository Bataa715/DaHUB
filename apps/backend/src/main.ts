import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import * as express from "express";
import helmet from "helmet";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");

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
    }),
  );

  // Large limit for /users (profile image base64) and /tailan (report base64 images)
  app.use("/users", express.json({ limit: "10mb" }));
  app.use("/users", express.urlencoded({ limit: "10mb", extended: true }));
  app.use("/tailan", express.json({ limit: "50mb" }));
  app.use("/tailan", express.urlencoded({ limit: "50mb", extended: true }));
  app.use("/news", express.json({ limit: "10mb" }));
  app.use("/news", express.urlencoded({ limit: "10mb", extended: true }));
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
      // Block requests with no origin in production (allow only in dev for curl/tools)
      if (!origin) {
        if (process.env.NODE_ENV !== "production") {
          callback(null, true);
        } else {
          callback(new Error("No origin"));
        }
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
      transform: true,
    }),
  );

  // Setup Swagger/OpenAPI documentation
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
    .addTag("fitness", "Fitness tracking")
    .build();

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(` Backend сервер ${port} порт дээр ажиллаж эхэллээ`);
  logger.log(` Security: SQL Injection protection enabled`);
  logger.log(` Environment: ${process.env.NODE_ENV || "development"}`);
}
bootstrap();
