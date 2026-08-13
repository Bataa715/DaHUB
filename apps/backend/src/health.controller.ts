import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { ClickHouseService } from "./clickhouse/clickhouse.service";

@Controller()
export class HealthController {
  constructor(private readonly clickhouse: ClickHouseService) {}

  // Pure liveness — "is the process up" only, no DB dependency. Load
  // balancers / uptime pings should hit this one for a fast, always-ok check.
  @Get()
  root() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "internal-audit-backend",
      docs: "/api/docs",
    };
  }

  // [OBS] Readiness — actually pings ClickHouse. Previously this returned a
  // static "ok" regardless of DB state, so the app could report healthy
  // while ClickHouse was completely unreachable. Returns 503 if the DB
  // query fails so monitoring/orchestration can detect real outages.
  @Get("health")
  async check() {
    const timestamp = new Date().toISOString();
    try {
      await this.clickhouse.query("SELECT 1");
      return {
        status: "ok",
        timestamp,
        service: "internal-audit-backend",
        db: "ok",
      };
    } catch (error: any) {
      throw new HttpException(
        {
          status: "error",
          timestamp,
          service: "internal-audit-backend",
          db: "unreachable",
          message: error?.message ?? String(error),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
