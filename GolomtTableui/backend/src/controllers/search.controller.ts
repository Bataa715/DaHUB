import { Controller, Get, Query, Headers, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { OracleService } from '../services/oracle.service';
import { AuthService, JwtPayload } from '../services/auth.service';
import { ConfigService } from '../services/config.service';

@Controller('search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(
    private readonly oracle: OracleService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private requireAuth(auth: string): JwtPayload {
    if (!auth) throw new HttpException('Нэвтрээгүй байна', HttpStatus.UNAUTHORIZED);
    const token = auth.replace(/^Bearer\s+/i, '');
    const payload = this.authService.verifyToken(token);
    if (!payload) throw new HttpException('Нэвтрээгүй байна', HttpStatus.UNAUTHORIZED);
    return payload;
  }

  /**
   * GET /api/search/cif?cif=R12345&from=2025-01-01&to=2026-04-08
   * 12 dashboard дээр CIF хайх
   */
  @Get('cif')
  async searchByCif(
    @Headers('authorization') auth: string,
    @Query('cif') cif: string,
    @Query('from') dateFrom: string,
    @Query('to') dateTo: string,
  ) {
    this.requireAuth(auth);

    if (!this.oracle.isConnected()) {
      throw new HttpException('Oracle холболт тохируулагдаагүй байна', HttpStatus.SERVICE_UNAVAILABLE);
    }

    if (!cif || typeof cif !== 'string') {
      throw new HttpException('CIF дугаар оруулна уу', HttpStatus.BAD_REQUEST);
    }

    // Sanitize CIF — only alphanumeric
    const safeCif = cif.trim().replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
    if (!safeCif) {
      throw new HttpException('CIF дугаар буруу байна', HttpStatus.BAD_REQUEST);
    }

    const results: {
      dashboardId: number;
      dashboardName: string;
      table: string;
      matchCount: number;
      totalAmount: number;
      rows: Record<string, any>[];
    }[] = [];

    const dashboards = this.configService.getEnabledDashboards();

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
            ? rows.reduce((sum, r) => {
                const val = Number(r[dash.amountColumn!]) || 0;
                return sum + val;
              }, 0)
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
        this.logger.warn(`DB${dash.id} (${dash.tableName}) CIF search failed: ${(err as Error).message}`);
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
   * GET /api/search/alerts?min_dashboards=2&limit=100
   * 2+ dashboard-д илэрсэн CIF-ийн жагсаалт (Alert)
   */
  @Get('alerts')
  async getAlerts(
    @Headers('authorization') auth: string,
    @Query('min_dashboards') minDash: string,
    @Query('limit') limitStr: string,
  ) {
    this.requireAuth(auth);

    if (!this.oracle.isConnected()) {
      throw new HttpException('Oracle холболт тохируулагдаагүй байна', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const minDashboards = Math.max(2, parseInt(minDash) || 2);
    const limit = Math.min(Math.max(parseInt(limitStr) || 100, 1), 500);

    // Collect CIF → dashboard appearances
    const cifMap: Record<string, { dashboards: { id: number; name: string; count: number; totalAmount: number }[] }> = {};

    const dashboards = this.configService.getEnabledDashboards();

    for (const dash of dashboards) {
      try {
        const sql = dash.amountColumn
          ? `SELECT ${dash.cifColumn} AS CIF_VAL, COUNT(*) AS CNT, SUM(NVL(${dash.amountColumn}, 0)) AS TOTAL_AMT FROM ${dash.tableName} GROUP BY ${dash.cifColumn} HAVING COUNT(*) >= 1`
          : `SELECT ${dash.cifColumn} AS CIF_VAL, COUNT(*) AS CNT, 0 AS TOTAL_AMT FROM ${dash.tableName} GROUP BY ${dash.cifColumn} HAVING COUNT(*) >= 1`;
        const rows = await this.oracle.query<{ CIF_VAL: string; CNT: number; TOTAL_AMT: number }>(sql);

        for (const row of rows) {
          const cifVal = String(row.CIF_VAL || '').trim();
          if (!cifVal) continue;

          if (!cifMap[cifVal]) {
            cifMap[cifVal] = { dashboards: [] };
          }
          cifMap[cifVal].dashboards.push({
            id: dash.id,
            name: dash.name,
            count: Number(row.CNT) || 0,
            totalAmount: Number(row.TOTAL_AMT) || 0,
          });
        }
      } catch (err) {
        this.logger.warn(`DB${dash.id} (${dash.tableName}) alert query failed: ${(err as Error).message}`);
      }
    }

    // Filter CIFs appearing in >= minDashboards
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

    return {
      minDashboards,
      totalAlerts: alerts.length,
      alerts,
    };
  }

  /**
   * GET /api/search/redflag
   * Event Chain дүрмийн илэрцүүд — 15 дүрэм
   */
  @Get('redflag')
  async getRedFlags(@Headers('authorization') auth: string) {
    this.requireAuth(auth);

    if (!this.oracle.isConnected()) {
      throw new HttpException('Oracle холболт тохируулагдаагүй байна', HttpStatus.SERVICE_UNAVAILABLE);
    }

    // 1. Dashboard бүрээс CIF жагсаалт авах
    const dashboards = this.configService.getEnabledDashboards();
    const cifSets: Record<number, Set<string>> = {};

    for (const dash of dashboards) {
      try {
        const sql = `SELECT DISTINCT ${dash.cifColumn} AS CIF_VAL FROM ${dash.tableName} WHERE ${dash.cifColumn} IS NOT NULL AND ROWNUM <= 50000`;
        const rows = await this.oracle.query<{ CIF_VAL: string }>(sql);
        cifSets[dash.id] = new Set(rows.map(r => String(r.CIF_VAL || '').trim()).filter(Boolean));
      } catch (err) {
        this.logger.warn(`DB${dash.id} (${dash.tableName}) redflag CIF query failed: ${(err as Error).message}`);
        cifSets[dash.id] = new Set();
      }
    }

    // 2. Chain бүрийн давхцал тооцох
    const enabledChains = this.configService.getEnabledChains();
    const chains = enabledChains.map(chain => {
      const sourceCifs = new Set<string>();
      for (const id of chain.sourceIds) {
        const set = cifSets[id];
        if (set) set.forEach(c => sourceCifs.add(c));
      }

      const targetCifs = new Set<string>();
      for (const id of chain.targetIds) {
        const set = cifSets[id];
        if (set) set.forEach(c => targetCifs.add(c));
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

    const triggeredChains = chains.filter(c => c.matchCount > 0).length;

    return {
      totalChains: chains.length,
      triggeredChains,
      totalMatches: chains.reduce((s, c) => s + c.matchCount, 0),
      chains,
    };
  }

  /**
   * GET /api/search/dashboard-list
   * 12 dashboard-ийн мэдээлэл
   */
  @Get('dashboard-list')
  getDashboardList(@Headers('authorization') auth: string) {
    this.requireAuth(auth);
    return {
      dashboards: this.configService.getEnabledDashboards().map(d => ({
        id: d.id,
        name: d.name,
        table: d.tableName,
      })),
    };
  }
}
