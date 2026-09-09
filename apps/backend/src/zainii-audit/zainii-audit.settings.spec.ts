import { describe, it, expect, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import {
  ZainiiAuditService,
  ZAINII_AUDIT_SETTING_DEFAULTS,
} from "./zainii-audit.service";
import type { ClickHouseService } from "../clickhouse/clickhouse.service";

/**
 * Зайны аудитын анхдагч тохиргоо.
 *
 * Энэ утга нь дэлгэц нээхэд хэрэглэгчид харагдах эхний шүүлтүүр тул буруу
 * уншигдвал (жишээ нь 0) хэрэглэгч бүх гүйлгээг татаж авах эрсдэлтэй.
 * Тиймээс уналт (fallback) бүрийг тестээр бэхлэв.
 */
type Row = { key: string; value: string };

function makeService(opts: {
  rows?: Row[];
  queryThrows?: unknown;
  onInsert?: (table: string, rows: unknown[]) => void;
}) {
  const insert = vi.fn(async (table: string, rows: unknown[]) => {
    opts.onInsert?.(table, rows);
  });
  const query = vi.fn(async () => {
    if (opts.queryThrows) throw opts.queryThrows;
    return (opts.rows ?? []) as unknown[];
  });
  const ch = { query, insert, exec: vi.fn() } as unknown as ClickHouseService;
  return { svc: new ZainiiAuditService(ch), query, insert };
}

describe("getSettings", () => {
  it("хүснэгт хоосон бол анхдагч утгыг буцаана", async () => {
    const { svc } = makeService({ rows: [] });
    await expect(svc.getSettings()).resolves.toEqual(
      ZAINII_AUDIT_SETTING_DEFAULTS,
    );
  });

  it("анхдагч нь 7 хоног / 50 сая байх ёстой", () => {
    expect(ZAINII_AUDIT_SETTING_DEFAULTS).toEqual({
      defaultMinAmount: 50_000_000,
      defaultDaysBack: 7,
    });
  });

  it("хадгалсан утгыг уншина", async () => {
    const { svc } = makeService({
      rows: [
        { key: "defaultMinAmount", value: "120000000" },
        { key: "defaultDaysBack", value: "30" },
      ],
    });
    await expect(svc.getSettings()).resolves.toEqual({
      defaultMinAmount: 120_000_000,
      defaultDaysBack: 30,
    });
  });

  it("зөвхөн нэг утга хадгалагдсан бол нөгөө нь анхдагчаар үлдэнэ", async () => {
    const { svc } = makeService({
      rows: [{ key: "defaultDaysBack", value: "14" }],
    });
    await expect(svc.getSettings()).resolves.toEqual({
      defaultMinAmount: ZAINII_AUDIT_SETTING_DEFAULTS.defaultMinAmount,
      defaultDaysBack: 14,
    });
  });

  it("тоо болж хөрвөхгүй утгыг үл тоомсорлож анхдагч руу ухарна", async () => {
    const { svc } = makeService({
      rows: [
        { key: "defaultMinAmount", value: "хог" },
        { key: "defaultDaysBack", value: "" },
      ],
    });
    await expect(svc.getSettings()).resolves.toEqual(
      ZAINII_AUDIT_SETTING_DEFAULTS,
    );
  });

  it("сөрөг утгыг татгалзаж анхдагч руу ухарна", async () => {
    const { svc } = makeService({
      rows: [{ key: "defaultMinAmount", value: "-5" }],
    });
    const s = await svc.getSettings();
    expect(s.defaultMinAmount).toBe(
      ZAINII_AUDIT_SETTING_DEFAULTS.defaultMinAmount,
    );
  });

  it("0 бол хүчинтэй утга (шүүлтүүргүй гэсэн үг)", async () => {
    const { svc } = makeService({
      rows: [{ key: "defaultMinAmount", value: "0" }],
    });
    const s = await svc.getSettings();
    expect(s.defaultMinAmount).toBe(0);
  });

  it("defaultDaysBack 0 байж болохгүй — анхдагч руу ухарна", async () => {
    // 0 хоног гэдэг нь эхлэх огноо = өнөөдөр → дэлгэц хоосон гарна.
    const { svc } = makeService({
      rows: [{ key: "defaultDaysBack", value: "0" }],
    });
    const s = await svc.getSettings();
    expect(s.defaultDaysBack).toBe(
      ZAINII_AUDIT_SETTING_DEFAULTS.defaultDaysBack,
    );
  });

  it("зөвхөн зайнаас бүрдсэн утгыг хоосонд тооцно", async () => {
    const { svc } = makeService({
      rows: [{ key: "defaultDaysBack", value: "   " }],
    });
    const s = await svc.getSettings();
    expect(s.defaultDaysBack).toBe(
      ZAINII_AUDIT_SETTING_DEFAULTS.defaultDaysBack,
    );
  });

  it("DB уначихвал УНАХГҮЙ, анхдагчаар үргэлжилнэ", async () => {
    // Хүснэгт хараахан үүсээгүй орчинд tool ажиллахаа болих ёсгүй.
    const { svc } = makeService({ queryThrows: new Error("no such table") });
    await expect(svc.getSettings()).resolves.toEqual(
      ZAINII_AUDIT_SETTING_DEFAULTS,
    );
  });
});

describe("updateSettings", () => {
  it("хоёр утгыг хадгална", async () => {
    let written: unknown[] = [];
    const { svc, insert } = makeService({
      rows: [
        { key: "defaultMinAmount", value: "90000000" },
        { key: "defaultDaysBack", value: "10" },
      ],
      onInsert: (_t, rows) => {
        written = rows;
      },
    });

    const res = await svc.updateSettings(
      { defaultMinAmount: 90_000_000, defaultDaysBack: 10 },
      { userId: "DAG-TEST" },
    );

    expect(insert).toHaveBeenCalledOnce();
    expect(written).toHaveLength(2);
    expect(res).toEqual({ defaultMinAmount: 90_000_000, defaultDaysBack: 10 });
  });

  it("хэсэгчилсэн шинэчлэлт — заасан талбарыг л бичнэ", async () => {
    let written: Row[] = [];
    const { svc } = makeService({
      rows: [],
      onInsert: (_t, rows) => {
        written = rows as Row[];
      },
    });

    await svc.updateSettings({ defaultDaysBack: 3 }, { userId: "u" });
    expect(written.map((r) => r.key)).toEqual(["defaultDaysBack"]);
  });

  it("хэн өөрчилснийг тэмдэглэнэ (аудитын мөр)", async () => {
    let written: { updatedBy?: string }[] = [];
    const { svc } = makeService({
      rows: [],
      onInsert: (_t, rows) => {
        written = rows as { updatedBy?: string }[];
      },
    });

    await svc.updateSettings({ defaultMinAmount: 1 }, { userId: "DAG-BATAA" });
    expect(written[0].updatedBy).toBe("DAG-BATAA");
  });

  it("хоосон хүсэлтийг татгалзана", async () => {
    const { svc, insert } = makeService({ rows: [] });
    await expect(svc.updateSettings({}, { userId: "u" })).rejects.toThrow(
      BadRequestException,
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("зөв хүснэгт рүү бичнэ", async () => {
    let table = "";
    const { svc } = makeService({
      rows: [],
      onInsert: (t) => {
        table = t;
      },
    });
    await svc.updateSettings({ defaultDaysBack: 5 }, { userId: "u" });
    expect(table).toBe("zainii_audit_settings");
  });
});
