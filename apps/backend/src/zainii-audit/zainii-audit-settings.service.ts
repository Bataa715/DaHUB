import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import { UpdateZainiiAuditSettingsDto } from "./dto/zainii-audit.dto";
import { nowCH } from "../clickhouse/clickhouse.service";
import {
  ZainiiAuditSettings,
  ZAINII_AUDIT_SETTING_DEFAULTS,
} from "./zainii-audit.types";

/** Зайны аудитын анхдагч шүүлтүүр (доод дүн, хоногийн тоо) — супер админ тохируулна. */
@Injectable()
export class ZainiiAuditSettingsService implements OnModuleInit {
  private readonly logger = new Logger(ZainiiAuditSettingsService.name);

  constructor(private readonly clickhouse: ClickHouseService) {}

  async onModuleInit() {
    await this.ensureSettingsTable();
  }

  private async ensureSettingsTable() {
    try {
      await this.clickhouse.exec(`
        CREATE TABLE IF NOT EXISTS zainii_audit_settings (
          key       String,
          value     String,
          updatedBy String DEFAULT '',
          updatedAt DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(updatedAt)
          ORDER BY key
      `);
    } catch (e) {
      this.logger.error("zainii_audit_settings таблиц үүсгэхэд алдаа:", e);
    }
  }

  async getSettings(): Promise<ZainiiAuditSettings> {
    let rows: { key: string; value: string }[] = [];
    try {
      rows = await this.clickhouse.query<{ key: string; value: string }>(
        `SELECT key, value FROM zainii_audit_settings FINAL LIMIT 100`,
      );
    } catch (e) {
      // Хүснэгт хараахан үүсээгүй / DB түр боломжгүй — анхдагчаар үргэлжилнэ.
      this.logger.warn(`zainii_audit_settings уншиж чадсангүй: ${String(e)}`);
    }
    const map = new Map(rows.map((r) => [r.key, r.value]));

    /**
     * Хадгалсан утгыг тоо болгоно; аль ч алхамд эргэлзээтэй бол анхдагч руу.
     *
     * ⚠️ `Number("")` нь 0 буцаадаг тул хоосон мөрийг ЗААВАЛ эхлээд шүүх
     * ёстой — эс бөгөөс `defaultDaysBack` нь 0 болж, хайлтын эхлэх огноо
     * өнөөдөр болж, дэлгэц хоосон гарна.
     */
    const num = (key: keyof ZainiiAuditSettings, min: number): number => {
      const fallback = ZAINII_AUDIT_SETTING_DEFAULTS[key];
      const raw = map.get(key);
      if (raw === undefined || raw.trim() === "") return fallback;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < min) return fallback;
      return parsed;
    };
    return {
      // Доод дүн 0 байж болно (= шүүлтүүргүй); хугацаа дор хаяж 1 хоног.
      defaultMinAmount: num("defaultMinAmount", 0),
      defaultDaysBack: num("defaultDaysBack", 1),
    };
  }

  async updateSettings(
    dto: UpdateZainiiAuditSettingsDto,
    user: { userId: string },
  ): Promise<ZainiiAuditSettings> {
    const rows: {
      key: string;
      value: string;
      updatedBy: string;
      updatedAt: string;
    }[] = [];
    const at = nowCH();

    const put = (key: keyof ZainiiAuditSettings, value?: number) => {
      if (value === undefined) return;
      rows.push({
        key,
        value: String(value),
        updatedBy: user.userId,
        updatedAt: at,
      });
    };
    put("defaultMinAmount", dto.defaultMinAmount);
    put("defaultDaysBack", dto.defaultDaysBack);

    if (rows.length === 0) {
      throw new BadRequestException("Өөрчлөх утга заагаагүй байна");
    }
    await this.clickhouse.insert("zainii_audit_settings", rows);
    return this.getSettings();
  }
}
