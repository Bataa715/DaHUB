import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { ClickHouseModule } from "./clickhouse/clickhouse.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { DepartmentsModule } from "./departments/departments.module";
import { FitnessModule } from "./fitness/fitness.module";
import { NewsModule } from "./news/news.module";
import { AuditLogModule } from "./audit/audit-log.module";
import { DbAccessModule } from "./db-access/db-access.module";
import { TailanModule } from "./tailan/tailan.module";
import { TuuwerModule } from "./tuuwer/tuuwer.module";
import { ChessModule } from "./chess/chess.module";
import { EnglishModule } from "./english/english.module";
import { ExcelReportModule } from "./excel-report/excel-report.module";
import { AdminDbModule } from "./admin-db/admin-db.module";
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
        name: "short",
        ttl: 1000, // 1 секунд
        limit: 20, // Ерөнхий throttle
      },
      {
        name: "login",
        ttl: 300000, // 5 минут
        limit: 5, // Дээд тал нь 5 оролдлого / 5 минут
      },
    ]),
    ScheduleModule.forRoot(),
    ClickHouseModule,
    AuditLogModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    FitnessModule,
    NewsModule,
    DbAccessModule,
    TailanModule,
    TuuwerModule,
    ChessModule,
    EnglishModule,
    ExcelReportModule,
    AdminDbModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
