import { registerAs } from "@nestjs/config";

export default registerAs("app", () => {
  // Validate JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  if (jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long");
  }
  if (jwtSecret === "your-secret-key-change-in-production") {
    throw new Error("JWT_SECRET must be changed from the default value");
  }

  // Parse CORS origins — root .env дахь CORS_ORIGINS-с унших
  const corsOrigins = process.env.CORS_ORIGINS?.split(",") || ["http://localhost:9002"];

  // Validate port
  const port = parseInt(process.env.PORT || "3001", 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid port number between 1 and 65535");
  }

  return {
    port,
    nodeEnv: process.env.NODE_ENV || "development",
    jwtSecret,
    corsOrigins,

    // ClickHouse configuration
    clickhouse: {
      host: process.env.CLICKHOUSE_HOST || "http://localhost:8123",
      user: process.env.CLICKHOUSE_USER || "default",
      password: process.env.CLICKHOUSE_PASSWORD || "",
      database: process.env.CLICKHOUSE_DATABASE || "audit_db",
    },
  };
});
