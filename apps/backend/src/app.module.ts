import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
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
        name: "login",
        ttl: 60000, // 60 секунд
        limit: 5, // Дээд тал нь 5 оролдлого / 60 секунд
      },
    ]),
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
