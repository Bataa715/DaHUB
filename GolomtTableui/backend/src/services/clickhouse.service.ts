import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, ClickHouseClient } from '@clickhouse/client';
import * as crypto from 'crypto';

const DB_NAME = 'audit_db';

function getChUser(): string {
  return process.env.CLICKHOUSE_USER || 'audit_app';
}
function getChPassword(): string {
  return process.env.CLICKHOUSE_PASSWORD || '';
}

/** ClickHouse DateTime64(3) format: '2026-04-02 06:59:39.546' */
export function chNow(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

@Injectable()
export class ClickHouseService implements OnModuleInit {
  private readonly logger = new Logger(ClickHouseService.name);
  private client: ClickHouseClient;

  async onModuleInit() {
    const chUrl = process.env.CLICKHOUSE_URL || 'http://localhost:8123';

    this.client = createClient({
      url: chUrl,
      username: getChUser(),
      password: getChPassword(),
      database: DB_NAME,
      max_open_connections: 10,
      request_timeout: 30000,
    });

    await this.initTables();
    await this.ensureDefaultAdmin();
    this.logger.log(`✅ ClickHouse connected → ${DB_NAME}`);
  }

  private async initTables() {
    await this.client.command({
      query: `
        CREATE TABLE IF NOT EXISTS app_users (
          id          String,
          username    String,
          password    String,
          displayName String,
          role        Enum8('admin' = 1, 'viewer' = 2),
          active      UInt8 DEFAULT 1,
          createdAt   DateTime64(3) DEFAULT now64(3),
          updatedAt   DateTime64(3) DEFAULT now64(3)
        ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY id
      `,
    });

    await this.client.command({
      query: `
        CREATE TABLE IF NOT EXISTS app_sessions (
          token       String,
          userId      String,
          expiresAt   DateTime64(3),
          createdAt   DateTime64(3) DEFAULT now64(3)
        ) ENGINE = MergeTree()
        ORDER BY token
        TTL toDateTime(expiresAt) + INTERVAL 1 DAY
      `,
    });

    this.logger.log('✅ Tables ensured: app_users, app_sessions');
  }

  async initGroupRegistryTable() {
    await this.client.command({
      query: `
        CREATE TABLE IF NOT EXISTS app_group_registry (
          id        String,
          config    String,
          updatedAt DateTime64(3) DEFAULT now64(3)
        ) ENGINE = ReplacingMergeTree(updatedAt)
        ORDER BY id
      `,
    });
  }

  async getGroupRegistry(): Promise<any[]> {
    await this.initGroupRegistryTable();
    const result = await this.client.query({
      query: `SELECT config FROM app_group_registry FINAL`,
      format: 'JSONEachRow',
    });
    const rows: { config: string }[] = await result.json();
    return rows.map(r => JSON.parse(r.config));
  }

  async upsertGroupEntry(group: any): Promise<void> {
    await this.initGroupRegistryTable();
    await this.client.insert({
      table: 'app_group_registry',
      values: [{ id: group.id, config: JSON.stringify(group), updatedAt: chNow() }],
      format: 'JSONEachRow',
    });
  }

  async deleteGroupEntry(id: string): Promise<void> {
    await this.initGroupRegistryTable();
    await this.client.command({
      query: `ALTER TABLE app_group_registry DELETE WHERE id = {id:String}`,
      query_params: { id },
    });
  }

  private async ensureDefaultAdmin() {
    const result = await this.client.query({
      query: `SELECT count() as cnt FROM app_users WHERE username = {username:String}`,
      query_params: { username: 'admin' },
      format: 'JSONEachRow',
    });
    const rows: any[] = await result.json();
    if (rows[0]?.cnt === '0' || rows[0]?.cnt === 0) {
      const bcrypt = require('bcryptjs');
      const defaultPw = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
      const hashedPw = await bcrypt.hash(defaultPw, 12);
      await this.client.insert({
        table: 'app_users',
        values: [{
          id: 'usr_admin_001',
          username: 'admin',
          password: hashedPw,
          displayName: 'Админ',
          role: 'admin',
          active: 1,
          createdAt: chNow(),
          updatedAt: chNow(),
        }],
        format: 'JSONEachRow',
      });
      this.logger.warn(`Default admin created. Username: admin, Password: ${defaultPw} — Please change it immediately.`);
    }
  }

  getClient(): ClickHouseClient {
    return this.client;
  }

  async query<T = any>(sql: string, params?: Record<string, any>): Promise<T[]> {
    const trimmed = sql.replace(/\s+/g, ' ').trim();
    // Allow SELECT and WITH, block everything else
    if (!/^(WITH\s+|SELECT\s)/i.test(trimmed)) {
      this.logger.error(`BLOCKED non-SELECT ClickHouse query: ${trimmed.substring(0, 100)}`);
      throw new Error('Зөвхөн SELECT query зөвшөөрнө. Өгөгдөл өөрчлөх үйлдэл хориглосон.');
    }
    const dangerous = [
      'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE',
      'SYSTEM', 'OPTIMIZE', 'GRANT', 'REVOKE', 'ATTACH', 'DETACH'
    ];
    for (const kw of dangerous) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(trimmed)) {
        this.logger.error(`BLOCKED dangerous keyword "${kw}" in CH query: ${trimmed.substring(0, 100)}`);
        throw new Error(`"${kw}" үйлдэл хориглосон. Зөвхөн SELECT зөвшөөрнө.`);
      }
    }

    const result = await this.client.query({
      query: sql,
      query_params: params,
      format: 'JSONEachRow',
    });
    return result.json() as Promise<T[]>;
  }

  async command(sql: string): Promise<void> {
    await this.client.command({ query: sql });
  }

  async insert(table: string, values: any[]): Promise<void> {
    await this.client.insert({ table, values, format: 'JSONEachRow' });
  }
}
