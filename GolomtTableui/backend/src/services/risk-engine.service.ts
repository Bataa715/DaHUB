import { Injectable } from '@nestjs/common';
import { Flag } from '../config/dashboards';

@Injectable()
export class RiskEngine {
  calculateRiskScore(flags: Flag[]): number {
    if (!flags.length) return 0;
    const w: Record<string, number> = { critical: 1, high: 0.7, medium: 0.4, low: 0.15 };
    const total = flags.reduce((s, f) => s + (w[f.severity] || 0.1), 0);
    return Math.min(+(total / flags.length).toFixed(3), 1);
  }

  getSeverityCounts(flags: Flag[]) {
    const c = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of flags) c[f.severity] = (c[f.severity] || 0) + 1;
    return c;
  }

  searchFlags(flags: Flag[], query: string): Flag[] {
    const q = query.toLowerCase();
    return flags.filter(f =>
      [f.customerName, f.customerId, f.accountNumber, f.title, f.description]
        .filter(Boolean).join(' ').toLowerCase().includes(q));
  }

  sortFlags(flags: Flag[], sortBy = 'severity', order = 'desc'): Flag[] {
    const so: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...flags];
    if (sortBy === 'severity') sorted.sort((a, b) => so[a.severity] - so[b.severity]);
    else if (sortBy === 'date') sorted.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
    else if (sortBy === 'amount') sorted.sort((a, b) => (b.amount || 0) - (a.amount || 0));
    if (order === 'asc') sorted.reverse();
    return sorted;
  }

  filterFlags(flags: Flag[], opts: any = {}): Flag[] {
    let r = flags;
    if (opts.severity) r = r.filter(f => f.severity === opts.severity);
    if (opts.dateFrom) r = r.filter(f => new Date(f.detectedAt) >= new Date(opts.dateFrom));
    if (opts.dateTo) r = r.filter(f => new Date(f.detectedAt) <= new Date(opts.dateTo));
    if (opts.minAmount != null) r = r.filter(f => (f.amount || 0) >= opts.minAmount);
    if (opts.maxAmount != null) r = r.filter(f => (f.amount || 0) <= opts.maxAmount);
    return r;
  }

  getTopRiskyCustomers(flags: Flag[], topN = 10) {
    const map: Record<string, { customerId: string; customerName: string; flags: Flag[] }> = {};
    for (const f of flags) {
      if (!f.customerId) continue;
      if (!map[f.customerId]) map[f.customerId] = { customerId: f.customerId, customerName: f.customerName!, flags: [] };
      map[f.customerId].flags.push(f);
    }
    return Object.values(map)
      .map(c => ({
        customerId: c.customerId, customerName: c.customerName,
        flagCount: c.flags.length, riskScore: this.calculateRiskScore(c.flags),
        severities: this.getSeverityCounts(c.flags),
        totalAmount: Math.round(c.flags.reduce((s, f) => s + (f.amount || 0), 0)),
      }))
      .sort((a, b) => b.riskScore - a.riskScore || b.flagCount - a.flagCount)
      .slice(0, topN);
  }
}
