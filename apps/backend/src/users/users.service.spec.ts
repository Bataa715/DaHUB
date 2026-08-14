import { describe, it, expect, vi, beforeEach } from "vitest";
import { UsersService } from "./users.service";

/**
 * Enforcement test for grantableTools scoping in updateTools:
 *   - a plain (non-super) admin may only grant/revoke tools inside their own
 *     grantableTools scope; tools the target already has OUTSIDE that scope are
 *     preserved untouched.
 *   - a superadmin sets tools directly.
 */

type Mock = ReturnType<typeof vi.fn>;

function makeService() {
  const clickhouse = {
    query: vi.fn(),
    replaceRows: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn().mockResolvedValue(undefined),
  };
  const authService = { invalidateUserValidation: vi.fn() };
  const svc = new UsersService(clickhouse as never, authService as never);
  return { svc, clickhouse };
}

function targetRow(allowedTools: string[]) {
  return {
    id: "u1",
    userId: "U1",
    name: "N",
    isAdmin: 0,
    isSuperAdmin: 0,
    isActive: 1,
    allowedTools: JSON.stringify(allowedTools),
    createdAt: "2026-01-01 00:00:00",
  };
}

/** The allowedTools actually written to the DB (from the replaceRows call). */
function savedTools(clickhouse: { replaceRows: Mock }): string[] {
  const rows = clickhouse.replaceRows.mock.calls[0][3] as {
    allowedTools: string;
  }[];
  return JSON.parse(rows[0].allowedTools);
}

describe("updateTools — grantableTools scope enforcement", () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it("sub-admin grants/revokes only within scope; out-of-scope tools preserved", async () => {
    (ctx.clickhouse.query as Mock)
      .mockResolvedValueOnce([targetRow(["a", "x"])]) // existing: a (in scope) + x (out of scope)
      .mockResolvedValueOnce([targetRow(["x", "b"])]); // re-fetch (irrelevant to assertion)

    await ctx.svc.updateTools("u1", ["b"], {
      isSuperAdmin: false,
      grantableTools: ["a", "b"],
    });

    // a removed (in scope, not requested), b added, x preserved (out of scope)
    expect(savedTools(ctx.clickhouse).sort()).toEqual(["b", "x"]);
  });

  it("sub-admin cannot grant a tool outside their scope", async () => {
    (ctx.clickhouse.query as Mock)
      .mockResolvedValueOnce([targetRow([])])
      .mockResolvedValueOnce([targetRow([])]);

    await ctx.svc.updateTools("u1", ["z"], {
      isSuperAdmin: false,
      grantableTools: ["a"],
    });

    expect(savedTools(ctx.clickhouse)).toEqual([]); // z stripped
  });

  it("superadmin sets tools directly", async () => {
    (ctx.clickhouse.query as Mock)
      .mockResolvedValueOnce([targetRow(["a"])])
      .mockResolvedValueOnce([targetRow(["b"])]);

    await ctx.svc.updateTools("u1", ["b"], {
      isSuperAdmin: true,
      grantableTools: [],
    });

    expect(savedTools(ctx.clickhouse)).toEqual(["b"]);
  });
});
