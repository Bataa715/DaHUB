import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { ClickHouseModule } from "./clickhouse/clickhouse.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { DepartmentsModule } from "./departments/departments.module";
import { MedlegModule } from "./medleg/medleg.module";
import { QuizModule } from "./quiz/quiz.module";
import { AuditLogModule } from "./audit/audit-log.module";
import { DbAccessModule } from "./db-access/db-access.module";
import { OracleModule } from "./oracle/oracle.module";
import { RiskAssessmentModule } from "./risk-assessment/risk-assessment.module";
import { RiskIndicatorConfigModule } from "./risk-indicator-config/risk-indicator-config.module";
import { HomepageEthicsModule } from "./homepage-ethics/homepage-ethics.module";
import { ZainiiAuditModule } from "./zainii-audit/zainii-audit.module";
import { NetworkAnalysisModule } from "./network-analysis/network-analysis.module";
import { NegativeNewsModule } from "./negative-news/negative-news.module";
import { DbChangesModule } from "./db-changes/db-changes.module";
import { HealthController } from "./health.controller";
import configuration from "./config/configuration";
import { validateEnv } from "./config/env.validation";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // [AUDIT] Өмнө нь энэ нь `return config` гэсэн хоосон stub байсан —
      // ямар ч шалгалт хийдэггүй байв. Одоо main.ts-тэй ижил, цор ганц
      // эх сурвалжтай баталгаажуулалтыг ажиллуулна.
      validate: validateEnv,
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
    // [ROUTE ORDER] QuizModule заавал MedlegModule-ээс өмнө байрлана —
    // MedlegController-т ":id" param route-той тул (quiz.controller.ts-ийн
    // толгой хэсгийн тайлбарыг үзнэ үү).
    QuizModule,
    MedlegModule,
    DbAccessModule,
    OracleModule,
    RiskAssessmentModule,
    RiskIndicatorConfigModule,
    HomepageEthicsModule,
    ZainiiAuditModule,
    NetworkAnalysisModule,
    NegativeNewsModule,
    DbChangesModule,
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
