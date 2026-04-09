import { Injectable } from '@nestjs/common';
import { DataService } from './data.service';
import { RiskEngine } from './risk-engine.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly dataService: DataService,
    private readonly riskEngine: RiskEngine,
  ) {}

  async listDashboards() {
    const defs = this.dataService.getDashboardDefs();
    const allData = await this.dataService.getAllFlags();

    const summaries = await Promise.all(defs.map(async (def) => {
      const flags = allData[def.id] || [];
      const counts = this.riskEngine.getSeverityCounts(flags);
      return {
        id: def.id, name: def.name, nameEn: def.nameEn,
        description: def.description, icon: def.icon, color: def.color,
        totalFlags: flags.length,
        criticalCount: counts.critical, highCount: counts.high,
        mediumCount: counts.medium, lowCount: counts.low,
        riskScore: this.riskEngine.calculateRiskScore(flags),
        lastUpdated: await this.dataService.getLastUpdated(def.id),
      };
    }));
    summaries.sort((a, b) => b.criticalCount - a.criticalCount || b.totalFlags - a.totalFlags);
    return { dashboards: summaries };
  }

  async getStats() {
    const defs = this.dataService.getDashboardDefs();
    const allData = await this.dataService.getAllFlags();
    const all = Object.values(allData).flat();
    const counts = this.riskEngine.getSeverityCounts(all);
    const cids = new Set(all.filter(f => f.customerId).map(f => f.customerId));
    return {
      totalDashboards: defs.length,
      totalFlags: all.length,
      ...counts,
      flaggedCustomers: cids.size,
      lastScan: new Date().toISOString(),
      riskScore: this.riskEngine.calculateRiskScore(all),
    };
  }

  async globalSearch(q: string) {
    const defs = this.dataService.getDashboardMap();
    const allData = await this.dataService.getAllFlags();
    const results: any[] = [];
    for (const [id, flags] of Object.entries(allData)) {
      const matched = this.riskEngine.searchFlags(flags, q);
      if (matched.length) {
        const def = defs[id];
        results.push({
          dashboardId: id,
          dashboardName: def?.name || id,
          dashboardIcon: def?.icon || '',
          dashboardColor: def?.color || '#666',
          matchCount: matched.length,
          flags: matched,
        });
      }
    }
    results.sort((a, b) => b.matchCount - a.matchCount);
    return { query: q, totalMatches: results.reduce((s, r) => s + r.matchCount, 0), results };
  }

  async getDashboard(id: string, params: any = {}) {
    const defs = this.dataService.getDashboardMap();
    const def = defs[id];
    if (!def) return null;

    let flags = await this.dataService.getFlagsForDashboard(id);
    const totalUnfiltered = flags.length;
    const allCounts = this.riskEngine.getSeverityCounts(flags);
    const riskScore = this.riskEngine.calculateRiskScore(flags);

    flags = this.riskEngine.filterFlags(flags, params);
    if (params.search) flags = this.riskEngine.searchFlags(flags, params.search);
    flags = this.riskEngine.sortFlags(flags, params.sortBy || 'severity', params.order || 'desc');
    const totalFiltered = flags.length;
    const page = parseInt(params.page) || 1;
    const pageSize = Math.min(parseInt(params.pageSize) || 20, 100);
    const start = (page - 1) * pageSize;
    return {
      dashboard: {
        id: def.id, name: def.name, nameEn: def.nameEn,
        description: def.description, icon: def.icon, color: def.color,
        totalFlags: totalUnfiltered,
        criticalCount: allCounts.critical, highCount: allCounts.high,
        mediumCount: allCounts.medium, lowCount: allCounts.low,
        riskScore,
        lastUpdated: await this.dataService.getLastUpdated(id),
      },
      flags: flags.slice(start, start + pageSize),
      pagination: {
        page, pageSize, totalItems: totalFiltered,
        totalPages: Math.max(1, Math.ceil(totalFiltered / pageSize)),
      },
    };
  }

  async getTopCustomers(id: string, topN = 10) {
    const flags = await this.dataService.getFlagsForDashboard(id);
    return { customers: this.riskEngine.getTopRiskyCustomers(flags, topN) };
  }

  async getNotifications(limit = 20) {
    const defs = this.dataService.getDashboardDefs();
    const defMap = this.dataService.getDashboardMap();
    const allData = await this.dataService.getAllFlags();
    const notifications: any[] = [];

    for (const [dashId, flags] of Object.entries(allData)) {
      const def = defMap[dashId];
      for (const f of flags) {
        if (f.severity === 'critical' || f.severity === 'high') {
          notifications.push({
            id: f.id,
            severity: f.severity,
            title: f.title,
            description: f.description,
            amount: f.amount,
            detectedAt: f.detectedAt,
            dashboardId: dashId,
            dashboardName: def?.name || dashId,
            dashboardColor: def?.color || '#666',
          });
        }
      }
    }

    notifications.sort((a, b) => {
      const sev = { critical: 0, high: 1 };
      if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity];
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });

    return {
      total: notifications.length,
      criticalCount: notifications.filter(n => n.severity === 'critical').length,
      highCount: notifications.filter(n => n.severity === 'high').length,
      items: notifications.slice(0, limit),
    };
  }

  async getRawResults(id: string) {
    return this.dataService.getRawResults(id);
  }
}
