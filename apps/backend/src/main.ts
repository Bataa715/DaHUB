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
  app.use(helmet({
    contentSecurityPolicy: false, // disabled — frontend is served separately
    crossOriginEmbedderPolicy: false,
  }));

  // Large limit only for /users endpoint (profile image base64 upload)
  app.use("/users", express.json({ limit: "10mb" }));
  app.use("/users", express.urlencoded({ limit: "10mb", extended: true }));
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

      // Check if origin is in whitelist
      if (corsOrigins.some((allowed) => origin.startsWith(allowed))) {
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
  const document = SwaggerModule.createDocument(app, config);
  if (process.env.NODE_ENV !== "production") {
    SwaggerModule.setup("api/docs", app, document);
    logger.log(` Swagger UI: http://localhost:${process.env.PORT || 3001}/api/docs`);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(` Backend сервер ${port} порт дээр ажиллаж эхэллээ`);
  logger.log(` Security: SQL Injection protection enabled`);
  logger.log(` Environment: ${process.env.NODE_ENV || "development"}`);
}
bootstrap();
