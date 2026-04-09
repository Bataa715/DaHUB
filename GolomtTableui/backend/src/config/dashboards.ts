import * as fs from 'fs';
import * as path from 'path';

export interface DashboardDef {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  icon: string;
  color: string;
  enabled: boolean;
}

export interface Flag {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  customerId: string | null;
  customerName: string | null;
  accountNumber: string | null;
  amount: number | null;
  detectedAt: string;
  category: string;
  details: Record<string, any>;
}

const CONFIG_PATH = path.join(__dirname, 'dashboard-registry.json');

export function loadDashboards(): DashboardDef[] {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  const defs: DashboardDef[] = JSON.parse(raw);
  return defs.filter(d => d.enabled);
}

export function loadDashboardMap(): Record<string, DashboardDef> {
  const map: Record<string, DashboardDef> = {};
  for (const d of loadDashboards()) map[d.id] = d;
  return map;
}
