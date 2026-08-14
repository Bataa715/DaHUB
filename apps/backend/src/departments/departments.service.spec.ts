import { describe, it, expect, vi, beforeEach } from "vitest";
import { DepartmentsService } from "./departments.service";
import { DEPARTMENT_CODES } from "../common/constants/departments";

type Mock = ReturnType<typeof vi.fn>;

function make() {
  const clickhouse = {
    query: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockResolvedValue(undefined),
  };
  const svc = new DepartmentsService(clickhouse as never);
  return { svc, clickhouse };
}

const ALL_NAMES = Object.keys(DEPARTMENT_CODES);

describe("DepartmentsService — default department seeding", () => {
  let ctx: ReturnType<typeof make>;
  beforeEach(() => {
    ctx = make();
  });

  it("seeds all canonical departments (with codes) when the table is empty", async () => {
    (ctx.clickhouse.query as Mock).mockResolvedValue([]);
    await ctx.svc.onModuleInit();

    const rows = (ctx.clickhouse.insert as Mock).mock.calls[0][1] as {
      name: string;
      code: string;
    }[];
    expect(rows).toHaveLength(ALL_NAMES.length);
    expect(rows.map((r) => r.name).sort()).toEqual([...ALL_NAMES].sort());
    expect(rows.find((r) => r.name === "Удирдлага")?.code).toBe("DAG");
    expect(
      rows.find((r) => r.name === "Чанарын баталгаажуулалтын алба")?.code,
    ).toBe("CHBA");
  });

  it("is idempotent — only inserts the missing departments", async () => {
    (ctx.clickhouse.query as Mock).mockResolvedValue([{ name: "Удирдлага" }]);
    await ctx.svc.onModuleInit();

    const rows = (ctx.clickhouse.insert as Mock).mock.calls[0][1] as {
      name: string;
    }[];
    expect(rows).toHaveLength(ALL_NAMES.length - 1);
    expect(rows.map((r) => r.name)).not.toContain("Удирдлага");
  });

  it("inserts nothing when every canonical department already exists", async () => {
    (ctx.clickhouse.query as Mock).mockResolvedValue(
      ALL_NAMES.map((name) => ({ name })),
    );
    await ctx.svc.onModuleInit();
    expect(ctx.clickhouse.insert as Mock).not.toHaveBeenCalled();
  });

  it("orders createdAt so a DESC sort lists Удирдлага first (canonical order)", async () => {
    (ctx.clickhouse.query as Mock).mockResolvedValue([]);
    await ctx.svc.onModuleInit();

    const rows = (ctx.clickhouse.insert as Mock).mock.calls[0][1] as {
      name: string;
      createdAt: string;
    }[];
    const byName = Object.fromEntries(rows.map((r) => [r.name, r.createdAt]));
    // Удирдлага (канон индекс 0) хамгийн сүүлийн timestamp-тай байх ёстой.
    const maxTs = rows
      .map((r) => r.createdAt)
      .reduce((a, b) => (a > b ? a : b));
    expect(byName["Удирдлага"]).toBe(maxTs);
  });
});
