import { Controller, Get, Post, Put, Delete, Param, Body, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '../services/config.service';
import { AuthService, JwtPayload } from '../services/auth.service';
import { AuditService } from '../services/audit.service';

@Controller('config')
export class ConfigController {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly audit: AuditService,
  ) {}

  private requireAdmin(auth: string): JwtPayload {
    if (!auth) throw new HttpException('Нэвтрээгүй байна', HttpStatus.UNAUTHORIZED);
    const token = auth.replace(/^Bearer\s+/i, '');
    const payload = this.authService.verifyToken(token);
    if (!payload) throw new HttpException('Нэвтрээгүй байна', HttpStatus.UNAUTHORIZED);
    if (payload.role !== 'admin') throw new HttpException('Зөвхөн админ эрхтэй', HttpStatus.FORBIDDEN);
    return payload;
  }

  // ── Oracle Dashboards ──────────────────────────────────────────────

  @Get('oracle-dashboards')
  getDashboards(@Headers('authorization') auth: string) {
    this.requireAdmin(auth);
    return { dashboards: this.config.loadDashboards() };
  }

  @Post('oracle-dashboards')
  addDashboard(@Headers('authorization') auth: string, @Body() body: any) {
    const user = this.requireAdmin(auth);
    if (!body.name || !body.tableName || !body.cifColumn) {
      throw new HttpException('name, tableName, cifColumn талбарууд шаардлагатай', HttpStatus.BAD_REQUEST);
    }
    try {
      const item = this.config.addDashboard({
        name: String(body.name).substring(0, 200),
        tableName: String(body.tableName).substring(0, 200),
        cifColumn: String(body.cifColumn).substring(0, 100),
        dateColumn: String(body.dateColumn || 'H_TRAN_DATE').substring(0, 100),
        amountColumn: String(body.amountColumn || 'H_TRAN_AMT_MNT').substring(0, 100),
        enabled: body.enabled !== false,
      });
      this.audit.log('ADD_ORACLE_DASHBOARD', user.userId, user.username, `dashboard_${item.id}`);
      return { status: 'added', dashboard: item };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put('oracle-dashboards/:id')
  updateDashboard(@Headers('authorization') auth: string, @Param('id') id: string, @Body() body: any) {
    const user = this.requireAdmin(auth);
    const numId = parseInt(id);
    if (!numId) throw new HttpException('Буруу ID', HttpStatus.BAD_REQUEST);
    try {
      const updates: any = {};
      if (body.name !== undefined) updates.name = String(body.name).substring(0, 200);
      if (body.tableName !== undefined) updates.tableName = String(body.tableName).substring(0, 200);
      if (body.cifColumn !== undefined) updates.cifColumn = String(body.cifColumn).substring(0, 100);
      if (body.dateColumn !== undefined) updates.dateColumn = String(body.dateColumn).substring(0, 100);
      if (body.amountColumn !== undefined) updates.amountColumn = String(body.amountColumn).substring(0, 100);
      if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled);
      const item = this.config.updateDashboard(numId, updates);
      if (!item) throw new HttpException('Олдсонгүй', HttpStatus.NOT_FOUND);
      this.audit.log('UPDATE_ORACLE_DASHBOARD', user.userId, user.username, `dashboard_${numId}`);
      return { status: 'updated', dashboard: item };
    } catch (e: any) {
      if (e.status) throw e;
      throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete('oracle-dashboards/:id')
  deleteDashboard(@Headers('authorization') auth: string, @Param('id') id: string) {
    const user = this.requireAdmin(auth);
    const numId = parseInt(id);
    if (!numId) throw new HttpException('Буруу ID', HttpStatus.BAD_REQUEST);
    const ok = this.config.deleteDashboard(numId);
    if (!ok) throw new HttpException('Олдсонгүй', HttpStatus.NOT_FOUND);
    this.audit.log('DELETE_ORACLE_DASHBOARD', user.userId, user.username, `dashboard_${numId}`);
    return { status: 'deleted' };
  }

  // ── Event Chains ───────────────────────────────────────────────────

  @Get('event-chains')
  getChains(@Headers('authorization') auth: string) {
    this.requireAdmin(auth);
    return { chains: this.config.loadChains() };
  }

  @Post('event-chains')
  addChain(@Headers('authorization') auth: string, @Body() body: any) {
    const user = this.requireAdmin(auth);
    if (!body.name || !Array.isArray(body.sourceIds) || !Array.isArray(body.targetIds)) {
      throw new HttpException('name, sourceIds, targetIds талбарууд шаардлагатай', HttpStatus.BAD_REQUEST);
    }
    const item = this.config.addChain({
      name: String(body.name).substring(0, 200),
      description: String(body.description || '').substring(0, 500),
      sourceLabel: String(body.sourceLabel || '').substring(0, 200),
      targetLabel: String(body.targetLabel || '').substring(0, 200),
      sourceIds: body.sourceIds.map(Number).filter((n: number) => n > 0),
      targetIds: body.targetIds.map(Number).filter((n: number) => n > 0),
      enabled: body.enabled !== false,
    });
    this.audit.log('ADD_EVENT_CHAIN', user.userId, user.username, `chain_${item.id}`);
    return { status: 'added', chain: item };
  }

  @Put('event-chains/:id')
  updateChain(@Headers('authorization') auth: string, @Param('id') id: string, @Body() body: any) {
    const user = this.requireAdmin(auth);
    const numId = parseInt(id);
    if (!numId) throw new HttpException('Буруу ID', HttpStatus.BAD_REQUEST);
    const updates: any = {};
    if (body.name !== undefined) updates.name = String(body.name).substring(0, 200);
    if (body.description !== undefined) updates.description = String(body.description).substring(0, 500);
    if (body.sourceLabel !== undefined) updates.sourceLabel = String(body.sourceLabel).substring(0, 200);
    if (body.targetLabel !== undefined) updates.targetLabel = String(body.targetLabel).substring(0, 200);
    if (Array.isArray(body.sourceIds)) updates.sourceIds = body.sourceIds.map(Number).filter((n: number) => n > 0);
    if (Array.isArray(body.targetIds)) updates.targetIds = body.targetIds.map(Number).filter((n: number) => n > 0);
    if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled);
    const item = this.config.updateChain(numId, updates);
    if (!item) throw new HttpException('Олдсонгүй', HttpStatus.NOT_FOUND);
    this.audit.log('UPDATE_EVENT_CHAIN', user.userId, user.username, `chain_${numId}`);
    return { status: 'updated', chain: item };
  }

  @Delete('event-chains/:id')
  deleteChain(@Headers('authorization') auth: string, @Param('id') id: string) {
    const user = this.requireAdmin(auth);
    const numId = parseInt(id);
    if (!numId) throw new HttpException('Буруу ID', HttpStatus.BAD_REQUEST);
    const ok = this.config.deleteChain(numId);
    if (!ok) throw new HttpException('Олдсонгүй', HttpStatus.NOT_FOUND);
    this.audit.log('DELETE_EVENT_CHAIN', user.userId, user.username, `chain_${numId}`);
    return { status: 'deleted' };
  }
}
