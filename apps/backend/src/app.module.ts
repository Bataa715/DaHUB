import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { ClickHouseModule } from "./clickhouse/clickhouse.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { DepartmentsModule } from "./departments/departments.module";
import { NewsModule } from "./news/news.module";
import { AuditLogModule } from "./audit/audit-log.module";
import { DbAccessModule } from "./db-access/db-access.module";
import { TailanModule } from "./tailan/tailan.module";
import { TuuwerModule } from "./tuuwer/tuuwer.module";
import { OracleModule } from "./oracle/oracle.module";
import { PythonApiModule } from "./python-api/python-api.module";
import { RiskAssessmentModule } from "./risk-assessment/risk-assessment.module";
import { WeeklyReportModule } from "./weekly-report/weekly-report.module";
import { HealthController } from "./health.controller";
import configuration from "./config/configuration";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: (config) => {
        // Additional validation can be added here
        return config;
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60000, // 1 minute
        limit: 120, // 120 requests per minute
      },
    ]),
    ScheduleModule.forRoot(),
    ClickHouseModule,
    AuditLogModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    NewsModule,
    DbAccessModule,
    TailanModule,
    TuuwerModule,
    OracleModule,
    PythonApiModule,
    RiskAssessmentModule,
    WeeklyReportModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
