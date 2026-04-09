import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface OracleDashboardConfig {
  id: number;
  name: string;
  tableName: string;
  cifColumn: string;
  dateColumn: string | null;
  amountColumn: string | null;
  enabled: boolean;
}

export interface EventChainConfig {
  id: number;
  name: string;
  description: string;
  sourceLabel: string;
  targetLabel: string;
  sourceIds: number[];
  targetIds: number[];
  enabled: boolean;
}

const DASHBOARDS_PATH = path.join(__dirname, '..', 'config', 'oracle-dashboards.json');
const CHAINS_PATH = path.join(__dirname, '..', 'config', 'event-chains.json');

// Validate Oracle identifier (table/column names) — prevent SQL injection
const IDENT_RE = /^[A-Z_][A-Z0-9_.]*$/i;

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  // ── Oracle Dashboards ──────────────────────────────────────────────

  loadDashboards(): OracleDashboardConfig[] {
    try {
      return JSON.parse(fs.readFileSync(DASHBOARDS_PATH, 'utf-8'));
    } catch {
      return [];
    }
  }

  getEnabledDashboards(): OracleDashboardConfig[] {
    return this.loadDashboards().filter(d => d.enabled);
  }

  private saveDashboards(items: OracleDashboardConfig[]) {
    fs.writeFileSync(DASHBOARDS_PATH, JSON.stringify(items, null, 2), 'utf-8');
  }

  addDashboard(d: Omit<OracleDashboardConfig, 'id'>): OracleDashboardConfig {
    this.validateDashboardFields(d);
    const all = this.loadDashboards();
    const maxId = all.reduce((m, x) => Math.max(m, x.id), 0);
    const item: OracleDashboardConfig = { id: maxId + 1, ...d };
    all.push(item);
    this.saveDashboards(all);
    this.logger.log(`Dashboard нэмэгдлээ: #${item.id} ${item.name}`);
    return item;
  }

  updateDashboard(id: number, updates: Partial<Omit<OracleDashboardConfig, 'id'>>): OracleDashboardConfig | null {
    if (updates.tableName || updates.cifColumn || updates.dateColumn || updates.amountColumn) {
      this.validateDashboardFields(updates as any);
    }
    const all = this.loadDashboards();
    const idx = all.findIndex(d => d.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates, id };
    this.saveDashboards(all);
    return all[idx];
  }

  deleteDashboard(id: number): boolean {
    const all = this.loadDashboards();
    const idx = all.findIndex(d => d.id === id);
    if (idx === -1) return false;
    all.splice(idx, 1);
    this.saveDashboards(all);
    this.logger.log(`Dashboard устгалаа: #${id}`);
    return true;
  }

  private validateDashboardFields(d: Partial<OracleDashboardConfig>) {
    if (d.tableName && !IDENT_RE.test(d.tableName)) {
      throw new Error('tableName буруу формат. Зөвхөн [A-Z0-9_.] зөвшөөрнө');
    }
    if (d.cifColumn && !IDENT_RE.test(d.cifColumn)) {
      throw new Error('cifColumn буруу формат');
    }
    if (d.dateColumn && !IDENT_RE.test(d.dateColumn)) {
      throw new Error('dateColumn буруу формат');
    }
    if (d.amountColumn && !IDENT_RE.test(d.amountColumn)) {
      throw new Error('amountColumn буруу формат');
    }
  }

  // ── Event Chains ───────────────────────────────────────────────────

  loadChains(): EventChainConfig[] {
    try {
      return JSON.parse(fs.readFileSync(CHAINS_PATH, 'utf-8'));
    } catch {
      return [];
    }
  }

  getEnabledChains(): EventChainConfig[] {
    return this.loadChains().filter(c => c.enabled);
  }

  private saveChains(items: EventChainConfig[]) {
    fs.writeFileSync(CHAINS_PATH, JSON.stringify(items, null, 2), 'utf-8');
  }

  addChain(c: Omit<EventChainConfig, 'id'>): EventChainConfig {
    const all = this.loadChains();
    const maxId = all.reduce((m, x) => Math.max(m, x.id), 0);
    const item: EventChainConfig = { id: maxId + 1, ...c };
    all.push(item);
    this.saveChains(all);
    this.logger.log(`Event Chain нэмэгдлээ: #${item.id} ${item.name}`);
    return item;
  }

  updateChain(id: number, updates: Partial<Omit<EventChainConfig, 'id'>>): EventChainConfig | null {
    const all = this.loadChains();
    const idx = all.findIndex(c => c.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates, id };
    this.saveChains(all);
    return all[idx];
  }

  deleteChain(id: number): boolean {
    const all = this.loadChains();
    const idx = all.findIndex(c => c.id === id);
    if (idx === -1) return false;
    all.splice(idx, 1);
    this.saveChains(all);
    this.logger.log(`Event Chain устгалаа: #${id}`);
    return true;
  }
}
