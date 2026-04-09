import { Injectable, Logger } from '@nestjs/common';
import { ClickHouseService, chNow } from './clickhouse.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET орчны хувьсагч тохируулагдаагүй эсвэл 32 тэмдэгтээс богино байна (Production орчинд заавал шаардлагатай)');
  }
  Logger.warn('⚠️ Оновчтой JWT_SECRET байхгүй тул түр зуурын санамсаргүй түлхүүр ашиглаж байна!', 'AuthService');
  return crypto.randomBytes(64).toString('hex');
}

const JWT_SECRET = getJwtSecret();
const JWT_EXPIRY = '8h';

export interface UserRow {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: 'admin' | 'viewer';
  active: number;
  createdAt: string;
  updatedAt: string;
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: 'admin' | 'viewer';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly ch: ClickHouseService) {}

  async login(username: string, password: string) {
    const users = await this.ch.query<UserRow>(
      `SELECT * FROM app_users WHERE username = {username:String} AND active = 1 LIMIT 1`,
      { username },
    );
    if (!users.length) return { error: 'Хэрэглэгч олдсонгүй' };

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return { error: 'Нууц үг буруу' };

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role } as JwtPayload,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY },
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    };
  }

  verifyToken(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      return null;
    }
  }

  async createUser(username: string, password: string, displayName: string, role: 'admin' | 'viewer') {
    // Check duplicate
    const existing = await this.ch.query(
      `SELECT count() as cnt FROM app_users WHERE username = {username:String}`,
      { username },
    );
    if (existing[0]?.cnt > 0) {
      return { error: `"${username}" нэртэй хэрэглэгч аль хэдийн байна` };
    }

    const hashedPw = await bcrypt.hash(password, 10);
    const id = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    await this.ch.insert('app_users', [{
      id,
      username,
      password: hashedPw,
      displayName,
      role,
      active: 1,
      createdAt: chNow(),
      updatedAt: chNow(),
    }]);

    return {
      status: 'created',
      user: { id, username, displayName, role },
    };
  }

  async listUsers() {
    const users = await this.ch.query<UserRow>(
      `SELECT id, username, displayName, role, active, createdAt FROM app_users FINAL WHERE active = 1 ORDER BY createdAt`,
    );
    return users.map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      createdAt: u.createdAt,
    }));
  }

  async deleteUser(userId: string) {
    // Soft delete via ReplacingMergeTree - insert with active=0
    const users = await this.ch.query<UserRow>(
      `SELECT * FROM app_users FINAL WHERE id = {userId:String} LIMIT 1`,
      { userId },
    );
    if (!users.length) return { error: 'Хэрэглэгч олдсонгүй' };
    if (users[0].username === 'admin') return { error: 'Үндсэн админ устгах боломжгүй' };

    await this.ch.insert('app_users', [{
      ...users[0],
      active: 0,
      updatedAt: chNow(),
    }]);

    return { status: 'deleted', userId };
  }

  async updateUserRole(userId: string, role: 'admin' | 'viewer') {
    const users = await this.ch.query<UserRow>(
      `SELECT * FROM app_users FINAL WHERE id = {userId:String} LIMIT 1`,
      { userId },
    );
    if (!users.length) return { error: 'Хэрэглэгч олдсонгүй' };

    await this.ch.insert('app_users', [{
      ...users[0],
      role,
      updatedAt: chNow(),
    }]);

    return { status: 'updated', userId, role };
  }

  async changePassword(userId: string, newPassword: string) {
    const users = await this.ch.query<UserRow>(
      `SELECT * FROM app_users FINAL WHERE id = {userId:String} LIMIT 1`,
      { userId },
    );
    if (!users.length) return { error: 'Хэрэглэгч олдсонгүй' };

    const hashedPw = await bcrypt.hash(newPassword, 10);
    await this.ch.insert('app_users', [{
      ...users[0],
      password: hashedPw,
      updatedAt: chNow(),
    }]);

    return { status: 'changed' };
  }
}
