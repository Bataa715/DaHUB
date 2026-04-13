import {
  Controller, Get, Query, UseGuards, Logger,
  HttpException, HttpStatus,
} from '@nestjs/common';
import { OracleService } from './oracle.service';
import { OracleConfigService } from './oracle-config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('oracle/search')
export class OracleSearchController {
  private readonly logger = new Logger(OracleSearchController.name);

  constructor(
    private readonly oracle: OracleService,
    private readonly config: OracleConfigService,
  ) {}

  private requireOracle() {
    if (!this.oracle.isConnected()) {
      throw new HttpException('Oracle холболт тохируулагдаагүй байна', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  /** GET /oracle/search/dashboards — all dashboard configs (id, name, table, enabled) */
  @Get('dashboards')
  getDashboards() {
    return this.config.loadDashboards().map(d => ({
      id: d.id,
      name: d.name,
      tableName: d.tableName,
      cifColumn: d.cifColumn,
      dateColumn: d.dateColumn,
      amountColumn: d.amountColumn,
      enabled: d.enabled,
    }));
  }

  /**
   * GET /api/oracle/search/cif?cif=R12345&from=2025-01-01&to=2026-04-09
   */
  @Get('cif')
  async searchByCif(
    @Query('cif') cif: string,
    @Query('from') dateFrom: string,
    @Query('to') dateTo: string,
  ) {
    this.requireOracle();

    if (!cif || typeof cif !== 'string') {
      throw new HttpException('CIF дугаар оруулна уу', HttpStatus.BAD_REQUEST);
    }

    const safeCif = cif.trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
    if (!safeCif) throw new HttpException('CIF дугаар буруу байна', HttpStatus.BAD_REQUEST);

    const dashboards = this.config.getEnabledDashboards();
    const results: {
      dashboardId: number;
      dashboardName: string;
      table: string;
      matchCount: number;
      totalAmount: number;
      rows: Record<string, any>[];
    }[] = [];

    for (const dash of dashboards) {
      try {
        let sql = `SELECT * FROM ${dash.tableName} WHERE ${dash.cifColumn} = :cif`;
        const params: any[] = [safeCif];

        if (dateFrom && dash.dateColumn) {
          sql += ` AND ${dash.dateColumn} >= TO_DATE(:dfrom, 'YYYY-MM-DD')`;
          params.push(dateFrom.substring(0, 10));
        }
        if (dateTo && dash.dateColumn) {
          sql += ` AND ${dash.dateColumn} <= TO_DATE(:dto, 'YYYY-MM-DD')`;
          params.push(dateTo.substring(0, 10));
        }
        sql += ` AND ROWNUM <= 200`;

        const rows = await this.oracle.query(sql, params);
        if (rows.length > 0) {
          const totalAmount = dash.amountColumn
            ? rows.reduce((s, r) => s + (Number(r[dash.amountColumn!]) || 0), 0)
            : 0;
          results.push({
            dashboardId: dash.id,
            dashboardName: dash.name,
            table: dash.tableName,
            matchCount: rows.length,
            totalAmount,
            rows,
          });
        }
      } catch (err) {
        this.logger.warn(`DB${dash.id} CIF query failed: ${(err as Error).message}`);
      }
    }

    results.sort((a, b) => b.matchCount - a.matchCount);

    return {
      cif: safeCif,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      totalDashboards: results.length,
      totalMatches: results.reduce((s, r) => s + r.matchCount, 0),
      results,
    };
  }

  /**
   * GET /api/oracle/search/alerts?min_dashboards=2&limit=200
   */
  @Get('alerts')
  async getAlerts(
    @Query('min_dashboards') minDash: string,
    @Query('limit') limitStr: string,
  ) {
    this.requireOracle();

    const minDashboards = Math.max(2, parseInt(minDash) || 2);
    const limit = Math.min(Math.max(parseInt(limitStr) || 100, 1), 500);

    const cifMap: Record<string, { dashboards: { id: number; name: string; count: number; totalAmount: number }[] }> = {};
    const dashboards = this.config.getEnabledDashboards();

    for (const dash of dashboards) {
      try {
        const sql = dash.amountColumn
          ? `SELECT ${dash.cifColumn} AS CIF_VAL, COUNT(*) AS CNT, SUM(NVL(${dash.amountColumn}, 0)) AS TOTAL_AMT FROM ${dash.tableName} GROUP BY ${dash.cifColumn} HAVING COUNT(*) >= 1`
          : `SELECT ${dash.cifColumn} AS CIF_VAL, COUNT(*) AS CNT, 0 AS TOTAL_AMT FROM ${dash.tableName} GROUP BY ${dash.cifColumn} HAVING COUNT(*) >= 1`;

        const rows = await this.oracle.query<{ CIF_VAL: string; CNT: number; TOTAL_AMT: number }>(sql);
        for (const row of rows) {
          const cifVal = String(row.CIF_VAL || '').trim();
          if (!cifVal) continue;
          if (!cifMap[cifVal]) cifMap[cifVal] = { dashboards: [] };
          cifMap[cifVal].dashboards.push({
            id: dash.id,
            name: dash.name,
            count: Number(row.CNT) || 0,
            totalAmount: Number(row.TOTAL_AMT) || 0,
          });
        }
      } catch (err) {
        this.logger.warn(`DB${dash.id} alerts query failed: ${(err as Error).message}`);
      }
    }

    const alerts = Object.entries(cifMap)
      .filter(([, v]) => v.dashboards.length >= minDashboards)
      .map(([cif, v]) => ({
        cif,
        dashboardCount: v.dashboards.length,
        totalTransactions: v.dashboards.reduce((s, d) => s + d.count, 0),
        totalAmount: v.dashboards.reduce((s, d) => s + d.totalAmount, 0),
        dashboards: v.dashboards.sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => b.dashboardCount - a.dashboardCount || b.totalAmount - a.totalAmount)
      .slice(0, limit);

    return { minDashboards, totalAlerts: alerts.length, alerts };
  }

  /**
   * GET /api/oracle/search/redflag
   */
  @Get('redflag')
  async getRedFlags() {
    this.requireOracle();

    const dashboards = this.config.getEnabledDashboards();
    const cifSets: Record<number, Set<string>> = {};

    for (const dash of dashboards) {
      try {
        const sql = `SELECT DISTINCT ${dash.cifColumn} AS CIF_VAL FROM ${dash.tableName} WHERE ${dash.cifColumn} IS NOT NULL AND ROWNUM <= 50000`;
        const rows = await this.oracle.query<{ CIF_VAL: string }>(sql);
        cifSets[dash.id] = new Set(rows.map(r => String(r.CIF_VAL || '').trim()).filter(Boolean));
      } catch (err) {
        this.logger.warn(`DB${dash.id} redflag CIF query failed: ${(err as Error).message}`);
        cifSets[dash.id] = new Set();
      }
    }

    const enabledChains = this.config.getEnabledChains();
    const chains = enabledChains.map(chain => {
      const sourceCifs = new Set<string>();
      for (const id of chain.sourceIds) {
        cifSets[id]?.forEach(c => sourceCifs.add(c));
      }

      const targetCifs = new Set<string>();
      for (const id of chain.targetIds) {
        cifSets[id]?.forEach(c => targetCifs.add(c));
      }

      const matches: string[] = [];
      for (const cif of sourceCifs) {
        if (targetCifs.has(cif)) matches.push(cif);
      }
      matches.sort();

      return {
        id: chain.id,
        name: chain.name,
        description: chain.description,
        sourceLabel: chain.sourceLabel,
        targetLabel: chain.targetLabel,
        sourceIds: chain.sourceIds,
        targetIds: chain.targetIds,
        matchCount: matches.length,
        matches: matches.slice(0, 500),
      };
    });

    return {
      totalChains: chains.length,
      triggeredChains: chains.filter(c => c.matchCount > 0).length,
      totalMatches: chains.reduce((s, c) => s + c.matchCount, 0),
      chains,
    };
  }
}
