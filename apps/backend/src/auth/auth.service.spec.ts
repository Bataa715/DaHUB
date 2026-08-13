import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "./auth.service";

/**
 * Unit tests for the two auth hardening fixes:
 *   1. refresh-token rotation grace  (concurrent refresh no longer logs out)
 *   2. validateUser() short-TTL cache (+ invalidation)
 *
 * The service is constructed manually with mocked collaborators so no real
 * ClickHouse / JWT is needed.
 */

type Mock = ReturnType<typeof vi.fn>;

function makeService() {
  const clickhouse = {
    query: vi.fn(),
    exec: vi.fn().mockResolvedValue(undefined),
    insert: vi.fn().mockResolvedValue(undefined),
  };
  const jwtService = { sign: vi.fn(() => "signed.jwt.token") };
  const auditLog = { log: vi.fn() };
  const service = new AuthService(
    clickhouse as never,
    jwtService as never,
    auditLog as never,
  );
  return { service, clickhouse, jwtService };
}

const userRow = {
  id: "u1",
  userId: "DAG-MTAH-Bataa",
  name: "Bataa",
  isActive: 1,
  isAdmin: 0,
  isSuperAdmin: 0,
  allowedTools: "[]",
  grantableTools: "[]",
};

describe("refreshAccessToken — rotation grace", () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it("rotates normally when the refresh token is valid", async () => {
    const q = ctx.clickhouse.query as Mock;
    q.mockResolvedValueOnce([{ userId: "u1" }]) // find refresh token
      .mockResolvedValueOnce([userRow]); // find user

    const res = await ctx.service.refreshAccessToken({ refreshToken: "rt-1" });

    expect(res.accessToken).toBe("signed.jwt.token");
    expect(res.user.id).toBe("u1");
    expect(ctx.clickhouse.exec).toHaveBeenCalledTimes(1); // old token deleted once
  });

  it("replays the SAME tokens for a concurrent duplicate instead of erroring", async () => {
    const q = ctx.clickhouse.query as Mock;
    // First refresh succeeds and rotates the token…
    q.mockResolvedValueOnce([{ userId: "u1" }]).mockResolvedValueOnce([userRow]);
    const first = await ctx.service.refreshAccessToken({ refreshToken: "rt-1" });

    // …second call with the SAME token now finds it deleted (returns []),
    // and must be served from the rotation grace rather than throwing.
    q.mockResolvedValueOnce([]);
    const second = await ctx.service.refreshAccessToken({ refreshToken: "rt-1" });

    expect(second).toEqual(first);
    // No second rotation happened — exec (delete) still called only once total.
    expect(ctx.clickhouse.exec).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown token that was never rotated", async () => {
    (ctx.clickhouse.query as Mock).mockResolvedValueOnce([]);
    await expect(
      ctx.service.refreshAccessToken({ refreshToken: "never-seen" }),
    ).rejects.toThrow();
  });
});

describe("validateUser — short-TTL cache + invalidation", () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it("serves a second lookup from cache (one DB read for a burst)", async () => {
    (ctx.clickhouse.query as Mock).mockResolvedValue([
      { ...userRow, departmentName: "IT" },
    ]);

    const a = await ctx.service.validateUser("u1");
    const b = await ctx.service.validateUser("u1");

    expect(a).toEqual(b);
    expect((a as { isActive: boolean }).isActive).toBe(true);
    expect(ctx.clickhouse.query).toHaveBeenCalledTimes(1);
  });

  it("re-reads from DB after invalidateUserValidation (immediate revocation)", async () => {
    (ctx.clickhouse.query as Mock).mockResolvedValue([
      { ...userRow, departmentName: "IT" },
    ]);

    await ctx.service.validateUser("u1");
    ctx.service.invalidateUserValidation("u1");
    await ctx.service.validateUser("u1");

    expect(ctx.clickhouse.query).toHaveBeenCalledTimes(2);
  });

  it("never caches a null (deactivated/deleted) result", async () => {
    (ctx.clickhouse.query as Mock).mockResolvedValue([]); // no active row

    const a = await ctx.service.validateUser("gone");
    const b = await ctx.service.validateUser("gone");

    expect(a).toBeNull();
    expect(b).toBeNull();
    expect(ctx.clickhouse.query).toHaveBeenCalledTimes(2); // re-read each time
  });
});
