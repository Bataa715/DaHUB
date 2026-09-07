import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import * as express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import compression from "compression";
import { randomUUID } from "crypto";
import { validateEnv } from "./config/env.validation";

// [SEC-3] Орчны хувьсагчийн шалгалт — NestFactory.create()-аас ӨМНӨ ажиллана
// (ямар нэг DB/HTTP холболт үүсгэхээс нааш буруу тохиргоог барих).
// Логик нь config/env.validation.ts-д ЦОР ГАНЦ хувилбараар байрлана —
// app.module.ts-ийн ConfigModule.validate мөн адилыг дуудна.
function validateProductionEnv() {
  validateEnv(process.env as Record<string, unknown>);
}

async function bootstrap() {
  validateProductionEnv();
  const app = await NestFactory.create(AppModule, {
    // "verbose"-ийг бүх орчинд хасна — хэвийн silent-refresh 401 логууд
    // (JwtAuthGuard / AllExceptionsFilter) verbose-д бичигддэг тул харагдахгүй.
    // Production дээр debug-ийг бас хасаж зөвхөн log/warn/error үлдээнэ.
    logger:
      process.env.NODE_ENV === "production"
        ? ["error", "warn", "log"]
        : ["error", "warn", "log", "debug"],
  });
  const logger = new Logger("Bootstrap");

  // [H-4] Trust reverse-proxy X-Forwarded-For only from the configured hop(s)
  // so req.ip resolves to the real client IP for brute-force lockout keys —
  // this MUST match your actual deployment topology or the header becomes
  // attacker-spoofable (see auth.controller.ts#clientIp for the consumer).
  //   TRUST_PROXY=1        → trust exactly 1 proxy hop (default: nginx/ingress in front)
  //   TRUST_PROXY=loopback → trust only loopback/private-network hops (Docker-internal proxy)
  //   TRUST_PROXY=0        → no proxy in front; never trust X-Forwarded-For
  const trustProxySetting = process.env.TRUST_PROXY ?? "1";
  const trustProxyValue: boolean | number | string =
    trustProxySetting === "0"
      ? false
      : /^\d+$/.test(trustProxySetting)
        ? Number(trustProxySetting)
        : trustProxySetting;
  app.getHttpAdapter().getInstance().set("trust proxy", trustProxyValue);

  // [OBS] Request-id correlation — trust an inbound X-Request-Id from the
  // reverse proxy if present (sanitised), otherwise mint one. Attached to the
  // request for the exception filter/logs and echoed back so a user-reported
  // error can be traced to its exact server log line. Exposed via CORS below.
  app.use((req: express.Request, res: express.Response, next: () => void) => {
    const inbound = req.headers["x-request-id"];
    const candidate =
      typeof inbound === "string" ? inbound.trim().slice(0, 64) : "";
    const rid = /^[A-Za-z0-9._-]+$/.test(candidate) ? candidate : randomUUID();
    (req as express.Request & { requestId?: string }).requestId = rid;
    res.setHeader("X-Request-Id", rid);
    next();
  });

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

  // [PERF] gzip compression; skip tiny payloads not worth the overhead.
  app.use(compression({ threshold: 1024 }));

  // Parse cookies (required for HttpOnly token cookies)
  app.use(cookieParser());

  // [M-5] Reduced /users from 10mb to 6mb (profile image limit is 5MB after base64 overhead)
  app.use("/users", express.json({ limit: "6mb" }));
  app.use("/users", express.urlencoded({ limit: "6mb", extended: true }));
  app.use("/tailan", express.json({ limit: "10mb" }));
  app.use("/tailan", express.urlencoded({ limit: "10mb", extended: true }));
  app.use("/medleg", express.json({ limit: "25mb" }));
  app.use("/medleg", express.urlencoded({ limit: "25mb", extended: true }));
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

  const port = process.env.PORT || 3001;
  await app.listen(port, "0.0.0.0");
  logger.log(` Backend сервер ${port} порт дээр ажиллаж эхэллээ`);
  logger.log(` Security: SQL Injection protection enabled`);
  logger.log(` Environment: ${process.env.NODE_ENV || "development"}`);
}
bootstrap();
