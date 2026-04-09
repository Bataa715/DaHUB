import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DashboardController } from './controllers/dashboard.controller';
import { AuthController } from './controllers/auth.controller';
import { HealthController } from './controllers/health.controller';
import { SearchController } from './controllers/search.controller';
import { ConfigController } from './controllers/config.controller';
import { DashboardService } from './services/dashboard.service';
import { DataService } from './services/data.service';
import { RiskEngine } from './services/risk-engine.service';
import { ClickHouseService } from './services/clickhouse.service';
import { AuthService } from './services/auth.service';
import { AuditService } from './services/audit.service';
import { OracleService } from './services/oracle.service';
import { ConfigService } from './services/config.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),
  ],
  controllers: [DashboardController, AuthController, HealthController, SearchController, ConfigController],
  providers: [
    DashboardService, DataService, RiskEngine, ClickHouseService, AuthService, AuditService, OracleService, ConfigService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
