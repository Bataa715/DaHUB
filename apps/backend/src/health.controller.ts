import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get()
  root() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "internal-audit-backend",
      docs: "/api/docs",
    };
  }

  @Get("health")
  check() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "internal-audit-backend",
    };
  }
}
