import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { AdminDbController } from "../src/admin-db/admin-db.controller";
import { ClickHouseService } from "../src/clickhouse/clickhouse.service";
import { ThrottlerModule } from "@nestjs/throttler";

const SUPER_ADMIN_REQ = {
  user: { id: "sa-1", userId: "sa", isAdmin: true, isSuperAdmin: true },
};

function makeClickhouse() {
  const mockClient = {
    query: jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        meta: [],
        data: [],
        rows: 0,
        statistics: null,
      }),
    }),
  };
  return {
    query: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockResolvedValue(undefined),
    exec: jest.fn().mockResolvedValue(undefined),
    getClient: jest.fn().mockReturnValue(mockClient),
  };
}

describe("AdminDbController", () => {
  let controller: AdminDbController;
  let ch: ReturnType<typeof makeClickhouse>;

  beforeEach(async () => {
    ch = makeClickhouse();
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ limit: 100, ttl: 60000 }])],
      controllers: [AdminDbController],
      providers: [
        { provide: ClickHouseService, useValue: ch },
      ],
    })
      // Skip JWT and SuperAdmin guards in unit tests
      .overrideGuard(require("../auth/jwt-auth.guard").JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require("../auth/guards/super-admin.guard").SuperAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get<AdminDbController>(AdminDbController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── Input validation ──────────────────────────────────────────────────────

  describe("execute — input validation", () => {
    it("throws BadRequestException for empty SQL", async () => {
      await expect(
        controller.execute({ sql: "" }, SUPER_ADMIN_REQ),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException for whitespace-only SQL", async () => {
      await expect(
        controller.execute({ sql: "   " }, SUPER_ADMIN_REQ),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when SQL exceeds 20 000 chars", async () => {
      const longSql = "SELECT " + "x".repeat(20_000);
      await expect(
        controller.execute({ sql: longSql }, SUPER_ADMIN_REQ),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException for multi-statement SQL (semicolon)", async () => {
      await expect(
        controller.execute(
          { sql: "SELECT 1; DROP TABLE users" },
          SUPER_ADMIN_REQ,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── DDL blocking ──────────────────────────────────────────────────────────

  describe("execute — blocked DDL patterns", () => {
    it("blocks DROP TABLE", async () => {
      await expect(
        controller.execute({ sql: "DROP TABLE users" }, SUPER_ADMIN_REQ),
      ).rejects.toThrow(BadRequestException);
    });

    it("blocks DROP DATABASE", async () => {
      await expect(
        controller.execute({ sql: "DROP DATABASE audit_db" }, SUPER_ADMIN_REQ),
      ).rejects.toThrow(BadRequestException);
    });

    it("blocks TRUNCATE TABLE", async () => {
      await expect(
        controller.execute({ sql: "TRUNCATE TABLE news" }, SUPER_ADMIN_REQ),
      ).rejects.toThrow(BadRequestException);
    });

    it("blocks GRANT statements", async () => {
      await expect(
        controller.execute(
          { sql: "GRANT SELECT ON *.* TO 'hacker'" },
          SUPER_ADMIN_REQ,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("blocks REVOKE statements", async () => {
      await expect(
        controller.execute(
          { sql: "REVOKE ALL ON *.* FROM 'user'" },
          SUPER_ADMIN_REQ,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("blocks CREATE USER", async () => {
      await expect(
        controller.execute(
          { sql: "CREATE USER hacker IDENTIFIED BY 'pass'" },
          SUPER_ADMIN_REQ,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("blocks comment-injection bypass: /* SELECT */ DROP TABLE", async () => {
      // Comments stripped → remaining starts with DROP TABLE → blocked
      await expect(
        controller.execute(
          { sql: "/* SELECT */ DROP TABLE users" },
          SUPER_ADMIN_REQ,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("blocks inline comment bypass: -- SELECT\\nDROP TABLE", async () => {
      await expect(
        controller.execute(
          { sql: "-- SELECT\nDROP TABLE users" },
          SUPER_ADMIN_REQ,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── Allowed queries ───────────────────────────────────────────────────────

  describe("execute — allowed queries", () => {
    it("executes SELECT and returns queryType SELECT", async () => {
      const result = await controller.execute(
        { sql: "SELECT id FROM users LIMIT 10" },
        SUPER_ADMIN_REQ,
      );
      expect(result.queryType).toBe("SELECT");
      expect(result).toHaveProperty("columns");
      expect(result).toHaveProperty("data");
    });

    it("executes SHOW TABLES and returns queryType SELECT", async () => {
      const result = await controller.execute(
        { sql: "SHOW TABLES" },
        SUPER_ADMIN_REQ,
      );
      expect(result.queryType).toBe("SELECT");
    });

    it("executes allowed DDL (ALTER TABLE ... ADD COLUMN) and returns COMMAND", async () => {
      const result = await controller.execute(
        { sql: "ALTER TABLE news ADD COLUMN tags String DEFAULT ''" },
        SUPER_ADMIN_REQ,
      );
      expect(result.queryType).toBe("COMMAND");
      expect(result.message).toBe("OK");
      expect(ch.exec).toHaveBeenCalledWith(
        "ALTER TABLE news ADD COLUMN tags String DEFAULT ''",
      );
    });

    it("executes CREATE TABLE IF NOT EXISTS and returns COMMAND", async () => {
      const result = await controller.execute(
        { sql: "CREATE TABLE IF NOT EXISTS test_table (id String) ENGINE = Memory" },
        SUPER_ADMIN_REQ,
      );
      expect(result.queryType).toBe("COMMAND");
    });
  });
});
