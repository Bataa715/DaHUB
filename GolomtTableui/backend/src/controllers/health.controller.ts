import { Controller, Get } from '@nestjs/common';
import { ClickHouseService } from '../services/clickhouse.service';

@Controller('health')
export class HealthController {
  constructor(private readonly ch: ClickHouseService) {}

  @Get()
  async check() {
    let dbStatus = 'unknown';
    try {
      await this.ch.query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      uptime: process.uptime(),
    };
  }
}
