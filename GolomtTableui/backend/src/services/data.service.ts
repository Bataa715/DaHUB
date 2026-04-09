import { Injectable, Logger } from '@nestjs/common';
import { Flag, DashboardDef, loadDashboards, loadDashboardMap } from '../config/dashboards';
import { ClickHouseService } from './clickhouse.service';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const QUERIES_DIR = path.join(DATA_DIR, 'queries');
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const QUERY_TIMEOUT_MS = 30000;

@Injectable()
export class DataService {
  private readonly logger = new Logger(DataService.name);

  constructor(private readonly clickhouse: ClickHouseService) {}

  /** Read flags — JSON cache first (with TTL), ClickHouse fallback */
  async getFlagsForDashboard(dashboardId: string): Promise<Flag[]> {
    const filePath = path.join(DATA_DIR, `${dashboardId}.json`);

    try {
      const stat = await fs.promises.stat(filePath);
      const age = Date.now() - stat.mtime.getTime();
      if (age > CACHE_TTL_MS) {
        this.logger.log(`Cache expired for ${dashboardId}, refreshing...`);
        return this.refreshFromClickHouse(dashboardId);
      }
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as Flag[];
    } catch (err) {
      // File doesn't exist or other error, fallback to clickhouse
    }

    return this.refreshFromClickHouse(dashboardId);
  }

  /** Execute ClickHouse query with timeout and save results to JSON cache */
  async refreshFromClickHouse(dashboardId: string): Promise<Flag[]> {
    const configPath = path.join(QUERIES_DIR, `${dashboardId}.json`);
    
    try {
      const configRaw = await fs.promises.readFile(configPath, 'utf-8');
      const config = JSON.parse(configRaw);

      // Query with timeout
      const rows = await Promise.race([
        this.clickhouse.query<Record<string, any>>(config.sqlQuery, config.params),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT_MS)
        ),
      ]);

      const flags = this.mapRowsToFlags(rows, config);

      try { await fs.promises.mkdir(DATA_DIR, { recursive: true }); } catch {}
      await fs.promises.writeFile(
        path.join(DATA_DIR, `${dashboardId}.json`),
        JSON.stringify(flags, null, 2),
        'utf-8',
      );
      await fs.promises.writeFile(
        path.join(DATA_DIR, `${dashboardId}_raw.json`),
        JSON.stringify(rows, null, 2),
        'utf-8',
      );
      this.logger.log(`${dashboardId}: ${flags.length} flags + ${rows.length} raw rows cached`);
      return flags;
    } catch (err) {
      this.logger.error(`ClickHouse query failed or config missing for ${dashboardId}: ${(err as Error).message}`);
      return [];
    }
  }

  /** Get raw ClickHouse query results for a dashboard */
  async getRawResults(dashboardId: string): Promise<{ columns: string[]; rows: Record<string, any>[]; queryConfig: any }> {
    const configPath = path.join(QUERIES_DIR, `${dashboardId}.json`);
    let config: any;
    try {
      const configRaw = await fs.promises.readFile(configPath, 'utf-8');
      config = JSON.parse(configRaw);
    } catch {
      return { columns: [], rows: [], queryConfig: null };
    }

    // Try raw cache first
    const rawPath = path.join(DATA_DIR, `${dashboardId}_raw.json`);
    try {
      const rawData = await fs.promises.readFile(rawPath, 'utf-8');
      const rows = JSON.parse(rawData);
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return { columns, rows, queryConfig: { sqlQuery: config.sqlQuery, params: config.params } };
    } catch {}

    // No cache → query ClickHouse
    try {
      const rows = await this.clickhouse.query<Record<string, any>>(config.sqlQuery, config.params);
      await fs.promises.writeFile(rawPath, JSON.stringify(rows, null, 2), 'utf-8');
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return { columns, rows, queryConfig: { sqlQuery: config.sqlQuery, params: config.params } };
    } catch (err) {
      this.logger.error(`Raw query failed for ${dashboardId}`, err);
      return { columns: [], rows: [], queryConfig: { sqlQuery: config.sqlQuery, params: config.params } };
    }
  }

  /** Map ClickHouse rows → Flag[] using query config */
  private mapRowsToFlags(rows: Record<string, any>[], config: any): Flag[] {
    const mapping = config.columnMapping || {};
    const rules = config.severityRules || {};
    const extraCols: string[] = config.extraDetailColumns || [];
    const category: string = config.category || 'Ерөнхий';
    const titleTpl: string = config.titleTemplate || '';
    const descTpl: string = config.descriptionTemplate || '';
    const mappedVals = new Set(Object.values(mapping));

    return rows.map((row, idx) => {
      const amount = Number(row[mapping.amount]) || 0;
      const severity = this.determineSeverity(amount, rules);
      const custId = String(row[mapping.customerId] ?? '');
      const acct = String(row[mapping.accountNumber] ?? '');
      const dateRaw = row[mapping.detectedAt];
      const detectedAt = dateRaw
        ? String(dateRaw).includes('T') ? String(dateRaw) : `${dateRaw}T00:00:00.000Z`
        : new Date().toISOString();

      const details: Record<string, any> = {};
      for (const col of extraCols) {
        if (row[col] !== undefined) details[col] = row[col];
      }
      for (const [key, val] of Object.entries(row)) {
        if (!mappedVals.has(key) && !extraCols.includes(key)) {
          details[key] = val;
        }
      }

      return {
        id: `FLAG-${config.id}-${idx.toString().padStart(4, '0')}`,
        severity,
        title: titleTpl ? this.formatTemplate(titleTpl, row) : `Flag #${idx + 1}`,
        description: descTpl ? this.formatTemplate(descTpl, row) : JSON.stringify(row),
        customerId: custId || null,
        customerName: row[mapping.customerName] || null,
        accountNumber: acct || null,
        amount,
        detectedAt,
        category,
        details,
      } as Flag;
    });
  }

  private determineSeverity(
    value: number,
    rules: { critical?: number; high?: number; medium?: number },
  ): 'critical' | 'high' | 'medium' | 'low' {
    if (rules.critical && value >= rules.critical) return 'critical';
    if (rules.high && value >= rules.high) return 'high';
    if (rules.medium && value >= rules.medium) return 'medium';
    return 'low';
  }

  private formatTemplate(tpl: string, row: Record<string, any>): string {
    return tpl.replace(/\{([^}]+)\}/g, (_, key) => {
      const val = row[key];
      if (val === undefined || val === null) return '';
      if (typeof val === 'number') return new Intl.NumberFormat('mn-MN').format(val);
      return String(val);
    });
  }

  /** Read all flags across all enabled dashboards */
  async getAllFlags(): Promise<Record<string, Flag[]>> {
    const defs = this.getDashboardDefs();
    const result: Record<string, Flag[]> = {};
    for (const def of defs) {
      result[def.id] = await this.getFlagsForDashboard(def.id);
    }
    return result;
  }

  getDashboardDefs(): DashboardDef[] {
    return loadDashboards();
  }

  getDashboardMap(): Record<string, DashboardDef> {
    return loadDashboardMap();
  }

  /** Get last modified time of a dashboard's data file */
  async getLastUpdated(dashboardId: string): Promise<string> {
    const filePath = path.join(DATA_DIR, `${dashboardId}.json`);
    try {
      const stat = await fs.promises.stat(filePath);
      return stat.mtime.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
}
