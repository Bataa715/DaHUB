import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogService } from "../src/audit/audit-log.service";
import { ClickHouseService } from "../src/clickhouse/clickhouse.service";

function makeClickhouse() {
  return {
    insert: jest.fn().mockResolvedValue(undefined),
    query: jest.fn(),
    exec: jest.fn().mockResolvedValue(undefined),
  };
}

const BASE_ENTRY = {
  userId: "user-1",
  userEmail: "user@example.com",
  action: "LOGIN",
  resource: "auth",
  method: "POST",
  status: "success" as const,
};

describe("AuditLogService", () => {
  let service: AuditLogService;
  let ch: ReturnType<typeof makeClickhouse>;

  beforeEach(async () => {
    ch = makeClickhouse();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: ClickHouseService, useValue: ch },
      ],
    }).compile();
    service = module.get<AuditLogService>(AuditLogService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── log ───────────────────────────────────────────────────────────────────

  describe("log", () => {
    it("inserts audit record into clickhouse", async () => {
      await service.log(BASE_ENTRY);
      expect(ch.insert).toHaveBeenCalledWith(
        "audit_logs",
        expect.arrayContaining([
          expect.objectContaining({
            userId: "user-1",
            action: "LOGIN",
            status: "success",
          }),
        ]),
      );
    });

    it("includes all required fields in the insert payload", async () => {
      await service.log(BASE_ENTRY);
      const payload = ch.insert.mock.calls[0][1][0];
      expect(payload).toHaveProperty("id");
      expect(payload).toHaveProperty("createdAt");
      expect(payload.userEmail).toBe("user@example.com");
      expect(payload.method).toBe("POST");
    });

    it("does NOT throw even when clickhouse insert fails", async () => {
      ch.insert.mockRejectedValueOnce(new Error("ClickHouse down"));
      await expect(service.log(BASE_ENTRY)).resolves.toBeUndefined();
    });

    it("stores empty string for optional fields when not provided", async () => {
      await service.log({
        userId: "user-2",
        action: "READ",
        resource: "news",
        method: "GET",
        status: "failure",
      });
      const payload = ch.insert.mock.calls[0][1][0];
      expect(payload.userEmail).toBe("");
      expect(payload.ipAddress).toBe("");
      expect(payload.userAgent).toBe("");
      expect(payload.errorMessage).toBe("");
    });

    it("serializes metadata to JSON string", async () => {
      await service.log({
        ...BASE_ENTRY,
        metadata: { requestId: "abc-123", extra: true },
      });
      const payload = ch.insert.mock.calls[0][1][0];
      const parsed = JSON.parse(payload.metadata);
      expect(parsed.requestId).toBe("abc-123");
    });
  });

  // ── getLogs ───────────────────────────────────────────────────────────────

  describe("getLogs", () => {
    it("returns logs without filters", async () => {
      ch.query.mockResolvedValueOnce([{ id: "log-1" }, { id: "log-2" }]);
      const result = await service.getLogs({});
      expect(result).toHaveLength(2);
    });

    it("applies userId filter", async () => {
      ch.query.mockResolvedValueOnce([]);
      await service.getLogs({ userId: "user-1" });
      // The query call should include userId param
      expect(ch.query).toHaveBeenCalledWith(
        expect.stringContaining("userId"),
        expect.objectContaining({ userId: "user-1" }),
      );
    });

    it("applies action filter", async () => {
      ch.query.mockResolvedValueOnce([]);
      await service.getLogs({ action: "LOGIN" });
      expect(ch.query).toHaveBeenCalledWith(
        expect.stringContaining("action"),
        expect.objectContaining({ action: "LOGIN" }),
      );
    });

    it("clamps limit to 1000", async () => {
      ch.query.mockResolvedValueOnce([]);
      await service.getLogs({ limit: 99999 });
      // The SQL should contain LIMIT with a capped value
      const sqlArg: string = ch.query.mock.calls[0][0];
      expect(sqlArg).toMatch(/LIMIT\s+1000\b/);
    });

    it("applies status filter", async () => {
      ch.query.mockResolvedValueOnce([]);
      await service.getLogs({ status: "failure" });
      expect(ch.query).toHaveBeenCalledWith(
        expect.stringContaining("status"),
        expect.objectContaining({ status: "failure" }),
      );
    });
  });
});
