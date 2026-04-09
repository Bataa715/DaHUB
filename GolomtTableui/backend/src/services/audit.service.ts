import { Injectable, Logger } from '@nestjs/common';

export interface AuditEntry {
  timestamp: string;
  userId: string;
  username: string;
  action: string;
  resource: string;
  details?: Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditLog');

  log(action: string, userId: string, username: string, resource: string, details?: Record<string, any>) {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      userId,
      username,
      action,
      resource,
      details: details ? this.maskSensitive(details) : undefined,
    };
    this.logger.log(JSON.stringify(entry));
  }

  private maskSensitive(obj: Record<string, any>): Record<string, any> {
    const masked = { ...obj };
    const sensitiveKeys = ['password', 'token', 'secret', 'newPassword', 'currentPassword'];
    for (const key of sensitiveKeys) {
      if (key in masked) masked[key] = '***';
    }
    return masked;
  }
}
