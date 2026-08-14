import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuditLogService } from "./audit-log.service";

type Mock = ReturnType<typeof vi.fn>;

function make() {
  const clickhouse = {
    query: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn().mockResolvedValue(undefined),
  };
  const svc = new AuditLogService(clickhouse as never);
  return { svc, clickhouse };
}

describe("AuditLogService.getLoginAttempts", () => {
  let ctx: ReturnType<typeof make>;
  beforeEach(() => {
    ctx = make();
  });

  it("maps rows and coerces success to boolean", async () => {
    (ctx.clickhouse.query as Mock).mockResolvedValue([
      { lockKey: "1.2.3.4", attemptedAt: "2026-01-01 00:00:00", success: 1 },
      { lockKey: "5.6.7.8", attemptedAt: "2026-01-01 00:01:00", success: 0 },
    ]);
    const res = await ctx.svc.getLoginAttempts(10);
    expect(res).toEqual([
      { lockKey: "1.2.3.4", attemptedAt: "2026-01-01 00:00:00", success: true },
      { lockKey: "5.6.7.8", attemptedAt: "2026-01-01 00:01:00", success: false },
    ]);
  });

  it("clamps the limit into [1, 1000] (0/NaN → default 200)", async () => {
    await ctx.svc.getLoginAttempts(999999);
    await ctx.svc.getLoginAttempts(0);
    const calls = (ctx.clickhouse.query as Mock).mock.calls;
    expect(calls[0][1]).toEqual({ limit: 1000 });
    expect(calls[1][1]).toEqual({ limit: 200 });
  });
});

describe("AuditLogService.getLogs", () => {
  let ctx: ReturnType<typeof make>;
  beforeEach(() => {
    ctx = make();
  });

  it("only binds params for the filters actually provided", async () => {
    await ctx.svc.getLogs({ action: "user_delete", status: "success" });
    const [sql, params] = (ctx.clickhouse.query as Mock).mock.calls[0];
    expect(params.action).toBe("user_delete");
    expect(params.status).toBe("success");
    expect(params.userId).toBeUndefined();
    expect(sql).toContain("action = {action:String}");
    expect(sql).not.toContain("userId = {userId:String}");
  });

  it("parses metadata JSON on the way out", async () => {
    (ctx.clickhouse.query as Mock).mockResolvedValue([
      { id: "1", action: "x", metadata: '{"targetId":"u9"}' },
      { id: "2", action: "y", metadata: "" },
    ]);
    const res = await ctx.svc.getLogs({});
    expect(res[0].metadata).toEqual({ targetId: "u9" });
    expect(res[1].metadata).toEqual({});
  });

  it("clamps limit to 1000 max", async () => {
    await ctx.svc.getLogs({ limit: 50000 });
    const params = (ctx.clickhouse.query as Mock).mock.calls[0][1];
    expect(params.limit).toBe(1000);
  });
});
