import { Controller, Get, Post, Delete, Query, Param, Body, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { DashboardService } from '../services/dashboard.service';
import { DataService } from '../services/data.service';
import { AuthService, JwtPayload } from '../services/auth.service';
import { AuditService } from '../services/audit.service';
import { loadDashboards } from '../config/dashboards';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const QUERIES_DIR = path.join(DATA_DIR, 'queries');
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'dashboard-registry.json');
const ICONS = ['Activity','Moon','UserX','Banknote','Copy','ShieldAlert','Radar','Eye','BarChart3','TrendingUp','AlertTriangle','Search','Zap','Shield','Database','FileText','Bell','Lock','Unlock','Globe'];
const COLORS = ['#EF4444','#F59E0B','#DC2626','#059669','#7C3AED','#0EA5E9','#E11D48','#D97706','#6366F1','#3B82F6','#10B981','#8B5CF6','#EC4899','#14B8A6','#F97316'];

// --- Sanitize dashboard ID to prevent path traversal ---
function sanitizeId(id: string): string {
  return id.replace(/[^a-z0-9_-]/gi, '').substring(0, 100);
}

// --- SQL validation: only SELECT allowed ---
function validateSqlQuery(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim().replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
  const upper = trimmed.toUpperCase();

  // Must start with SELECT
  if (!upper.startsWith('SELECT')) {
    return { valid: false, error: 'Зөвхөн SELECT query зөвшөөрөгдөнө' };
  }

  // Disallow dangerous keywords
  const forbidden = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'TRUNCATE', 'EXEC', 'EXECUTE', 'GRANT', 'REVOKE', 'MERGE'];
  for (const kw of forbidden) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(trimmed)) {
      return { valid: false, error: `"${kw}" хэрэглэх боломжгүй. Зөвхөн SELECT query зөвшөөрнө` };
    }
  }

  // Disallow semicolons (prevents multi-statement injection)
  if (trimmed.includes(';')) {
    return { valid: false, error: 'Олон statement ажиллуулах боломжгүй' };
  }

  return { valid: true };
}

const CYRILLIC_MAP: Record<string,string> = {
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'ye','ё':'yo','ж':'j','з':'z','и':'i',
  'й':'i','к':'k','л':'l','м':'m','н':'n','о':'o','ө':'u','п':'p','р':'r','с':'s',
  'т':'t','у':'u','ү':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'sh',
  'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
};
function slugify(text: string): string {
  let result = '';
  for (const ch of text.toLowerCase()) {
    if (CYRILLIC_MAP[ch] !== undefined) result += CYRILLIC_MAP[ch];
    else if (/[a-z0-9]/.test(ch)) result += ch;
    else if (/[\s_-]/.test(ch)) result += '_';
  }
  return result.replace(/_+/g, '_').replace(/^_|_$/g, '') || `dashboard_${Date.now()}`;
}

function parseSqlColumns(sql: string): string[] {
  const cleaned = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const match = cleaned.match(/SELECT\s+([\s\S]*?)\s+FROM/i);
  if (!match) return [];
  const selectClause = match[1];
  if (selectClause.trim() === '*') return ['id','column1','column2','column3'];
  return selectClause.split(',').map(col => {
    const trimmed = col.trim();
    const aliasMatch = trimmed.match(/\s+(?:AS\s+)?["']?([^"'\s,]+)["']?\s*$/i);
    if (aliasMatch) return aliasMatch[1];
    const dotMatch = trimmed.match(/\.(\w+)$/);
    if (dotMatch) return dotMatch[1];
    const simple = trimmed.match(/^["']?(\w+)["']?$/);
    if (simple) return simple[1];
    return trimmed.replace(/[^a-zA-Z0-9_\u0400-\u04FF]/g, '_');
  }).filter(c => c.length > 0);
}

@Controller('dashboards')
export class DashboardController {
  constructor(
    private readonly svc: DashboardService,
    private readonly authService: AuthService,
    private readonly dataService: DataService,
    private readonly audit: AuditService,
  ) {}

  // --- Auth helpers ---
  private extractUser(auth: string): JwtPayload | null {
    if (!auth) return null;
    const token = auth.replace(/^Bearer\s+/i, '');
    return this.authService.verifyToken(token);
  }

  private requireAuth(auth: string): JwtPayload {
    const payload = this.extractUser(auth);
    if (!payload) throw new HttpException('Нэвтрээгүй байна', HttpStatus.UNAUTHORIZED);
    return payload;
  }

  private requireAdmin(auth: string): JwtPayload {
    const payload = this.requireAuth(auth);
    if (payload.role !== 'admin') throw new HttpException('Зөвхөн админ эрхтэй', HttpStatus.FORBIDDEN);
    return payload;
  }

  // --- ALL endpoints require auth ---

  @Get()
  async list(@Headers('authorization') auth: string) {
    this.requireAuth(auth);
    return this.svc.listDashboards();
  }

  @Get('stats')
  async stats(@Headers('authorization') auth: string) {
    this.requireAuth(auth);
    return this.svc.getStats();
  }

  @Get('notifications')
  async notifications(@Headers('authorization') auth: string, @Query('limit') limit: string) {
    this.requireAuth(auth);
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    return this.svc.getNotifications(parsedLimit);
  }

  @Get('search')
  async search(@Headers('authorization') auth: string, @Query('q') q: string) {
    this.requireAuth(auth);
    if (!q || typeof q !== 'string') return { query: '', totalMatches: 0, results: [] };
    const sanitized = q.trim().substring(0, 200);
    return this.svc.globalSearch(sanitized);
  }

  @Get('config')
  getConfig(@Headers('authorization') auth: string) {
    this.requireAuth(auth);
    return { dashboards: loadDashboards() };
  }

  @Get('icons')
  getIcons(@Headers('authorization') auth: string) {
    this.requireAuth(auth);
    return { icons: ICONS };
  }

  @Get('colors')
  getColors(@Headers('authorization') auth: string) {
    this.requireAuth(auth);
    return { colors: COLORS };
  }

  @Post('config')
  addDashboard(@Headers('authorization') auth: string, @Body() body: any) {
    const user = this.requireAdmin(auth);

    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const defs = JSON.parse(raw);

    if (!body.id || !body.name) {
      return { error: 'id, name fields are required' };
    }

    const safeId = sanitizeId(body.id);
    if (defs.find((d: any) => d.id === safeId)) {
      return { error: `Dashboard with id "${safeId}" already exists` };
    }

    defs.push({
      id: safeId,
      name: String(body.name).substring(0, 200),
      nameEn: String(body.nameEn || body.name).substring(0, 200),
      description: String(body.description || '').substring(0, 500),
      icon: ICONS.includes(body.icon) ? body.icon : 'BarChart3',
      color: body.color || '#6B7280',
      enabled: body.enabled !== false,
    });

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defs, null, 2), 'utf-8');
    this.audit.log('ADD_DASHBOARD_CONFIG', user.userId, user.username, safeId);
    return { status: 'added', dashboard: defs[defs.length - 1] };
  }

  @Post('create')
  async createDashboard(
    @Headers('authorization') auth: string,
    @Body() body: {
      name: string; nameEn?: string; description?: string;
      sqlQuery: string; icon?: string; color?: string;
      params?: Record<string, any>;
      columnMapping?: Record<string, string>;
      severityRules?: Record<string, number>;
      titleTemplate?: string;
      descriptionTemplate?: string;
      category?: string;
      extraDetailColumns?: string[];
    },
  ) {
    const user = this.requireAdmin(auth);

    if (!body.name || !body.sqlQuery) {
      return { error: 'name болон sqlQuery талбарууд шаардлагатай' };
    }

    // Validate SQL — only SELECT allowed
    const sqlCheck = validateSqlQuery(body.sqlQuery);
    if (!sqlCheck.valid) {
      return { error: sqlCheck.error };
    }

    const id = sanitizeId(slugify(body.name)) || `dashboard_${Date.now()}`;

    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const defs = JSON.parse(raw);
    if (defs.find((d: any) => d.id === id)) {
      return { error: `"${id}" ID-тэй dashboard аль хэдийн байна. Өөр нэр сонгоно уу.` };
    }

    const columns = parseSqlColumns(body.sqlQuery);
    const icon = ICONS.includes(body.icon || '') ? body.icon! : ICONS[Math.floor(Math.random() * ICONS.length)];
    const color = body.color || COLORS[defs.length % COLORS.length];

    if (!fs.existsSync(QUERIES_DIR)) fs.mkdirSync(QUERIES_DIR, { recursive: true });
    const queryConfig = {
      id,
      name: String(body.name).substring(0, 200),
      sqlQuery: body.sqlQuery,
      params: body.params || {},
      columnMapping: body.columnMapping || {},
      severityRules: body.severityRules || {},
      titleTemplate: body.titleTemplate || '',
      descriptionTemplate: body.descriptionTemplate || '',
      category: body.category || 'Ерөнхий',
      extraDetailColumns: body.extraDetailColumns || columns,
      columns,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(QUERIES_DIR, `${id}.json`),
      JSON.stringify(queryConfig, null, 2), 'utf-8',
    );

    let flagCount = 0;
    let dataSource = 'clickhouse';
    try {
      const flags = await this.dataService.refreshFromClickHouse(id);
      flagCount = flags.length;
    } catch (err: any) {
      dataSource = `clickhouse (алдаа: ${err.message})`;
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), '[]', 'utf-8');
    }

    const newDef = {
      id, name: String(body.name).substring(0, 200), nameEn: String(body.nameEn || body.name).substring(0, 200),
      description: String(body.description || `${body.name} - автоматаар үүсгэсэн dashboard`).substring(0, 500),
      icon, color, enabled: true,
    };
    defs.push(newDef);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defs, null, 2), 'utf-8');

    this.audit.log('CREATE_DASHBOARD', user.userId, user.username, id, { flagCount, columns });
    return { status: 'created', dashboard: newDef, columns, flagCount, dataSource, queryConfig };
  }

  @Delete(':id')
  deleteDashboard(
    @Headers('authorization') auth: string,
    @Param('id') idParam: string,
    @Body() body: { confirm?: boolean },
  ) {
    const user = this.requireAdmin(auth);
    const id = sanitizeId(idParam);

    if (!body?.confirm) {
      return { error: 'Dashboard устгахыг баталгаажуулна уу (confirm: true)' };
    }

    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const defs = JSON.parse(raw);
    const idx = defs.findIndex((d: any) => d.id === id);
    if (idx === -1) return { error: 'Dashboard олдсонгүй' };

    const removed = defs.splice(idx, 1)[0];
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defs, null, 2), 'utf-8');

    const dataPath = path.join(DATA_DIR, `${id}.json`);
    if (fs.existsSync(dataPath)) fs.unlinkSync(dataPath);
    const rawPath = path.join(DATA_DIR, `${id}_raw.json`);
    if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
    const queryPath = path.join(QUERIES_DIR, `${id}.json`);
    if (fs.existsSync(queryPath)) fs.unlinkSync(queryPath);

    this.audit.log('DELETE_DASHBOARD', user.userId, user.username, id, { name: removed.name });
    return { status: 'deleted', dashboard: removed };
  }

  @Post(':id/refresh')
  async refreshDashboard(@Headers('authorization') auth: string, @Param('id') idParam: string) {
    const user = this.requireAdmin(auth);
    const id = sanitizeId(idParam);

    const queryPath = path.join(QUERIES_DIR, `${id}.json`);
    if (!fs.existsSync(queryPath)) {
      return { error: 'Энэ dashboard-ийн SQL тохиргоо олдсонгүй' };
    }
    try {
      const flags = await this.dataService.refreshFromClickHouse(id);
      this.audit.log('REFRESH_DASHBOARD', user.userId, user.username, id, { flagCount: flags.length });
      return { status: 'refreshed', flagCount: flags.length };
    } catch (err: any) {
      return { error: 'ClickHouse шинэчлэлт амжилтгүй' };
    }
  }

  @Get(':id')
  async detail(@Headers('authorization') auth: string, @Param('id') idParam: string, @Query() query: any) {
    this.requireAuth(auth);
    const id = sanitizeId(idParam);
    const result = await this.svc.getDashboard(id, {
      search: query.search ? String(query.search).substring(0, 200) : null,
      severity: ['critical', 'high', 'medium', 'low'].includes(query.severity) ? query.severity : null,
      sortBy: ['severity', 'date', 'amount'].includes(query.sort_by) ? query.sort_by : 'severity',
      order: query.order === 'asc' ? 'asc' : 'desc',
      page: Math.max(1, parseInt(query.page) || 1),
      pageSize: Math.min(Math.max(parseInt(query.page_size) || 20, 1), 50),
      dateFrom: query.date_from || null,
      dateTo: query.date_to || null,
      minAmount: query.min_amount ? parseFloat(query.min_amount) : null,
      maxAmount: query.max_amount ? parseFloat(query.max_amount) : null,
    });
    if (!result) throw new HttpException('Dashboard not found', HttpStatus.NOT_FOUND);
    return result;
  }

  @Get(':id/top-customers')
  async topCustomers(@Headers('authorization') auth: string, @Param('id') idParam: string, @Query('top_n') topN: string) {
    this.requireAuth(auth);
    const id = sanitizeId(idParam);
    const n = Math.min(Math.max(parseInt(topN) || 10, 1), 50);
    return this.svc.getTopCustomers(id, n);
  }

  @Get(':id/raw-results')
  async rawResults(@Headers('authorization') auth: string, @Param('id') idParam: string) {
    this.requireAuth(auth);
    const id = sanitizeId(idParam);
    return this.svc.getRawResults(id);
  }
}
