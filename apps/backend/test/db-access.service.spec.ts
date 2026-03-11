import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { DbAccessService } from "../src/db-access/db-access.service";
import { ClickHouseService } from "../src/clickhouse/clickhouse.service";
import { ClickHouseAccessService } from "../src/db-access/clickhouse-access.service";

function makeClickhouse() {
  return {
    query: jest.fn(),
    insert: jest.fn().mockResolvedValue(undefined),
    exec: jest.fn().mockResolvedValue(undefined),
    getClient: jest.fn(),
  };
}

function makeChAccess() {
  return {
    setupUserAndRole: jest.fn().mockResolvedValue(undefined),
    grantTableToRole: jest.fn().mockResolvedValue(undefined),
    revokeAccess: jest.fn().mockResolvedValue(undefined),
    cleanupUserChAccess: jest
      .fn()
      .mockResolvedValue({ rolesDropped: [], userDropped: false }),
  };
}

const ADMIN_USER = {
  id: "admin-1",
  name: "Болд",
  userId: "bold",
  isAdmin: true,
  isSuperAdmin: false,
  allowedTools: [],
};

const REGULAR_USER = {
  id: "user-1",
  name: "Нямаа",
  userId: "nyamaa",
  isAdmin: false,
  isSuperAdmin: false,
  allowedTools: [],
};

const GRANTER_USER = {
  ...REGULAR_USER,
  allowedTools: ["db_access_granter"],
};

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

describe("DbAccessService", () => {
  let service: DbAccessService;
  let ch: ReturnType<typeof makeClickhouse>;
  let chAccess: ReturnType<typeof makeChAccess>;

  beforeEach(async () => {
    ch = makeClickhouse();
    chAccess = makeChAccess();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DbAccessService,
        { provide: ClickHouseService, useValue: ch },
        { provide: ClickHouseAccessService, useValue: chAccess },
      ],
    }).compile();
    service = module.get<DbAccessService>(DbAccessService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createRequest ─────────────────────────────────────────────────────────

  describe("createRequest", () => {
    const validDto = {
      tables: ["FINACLE.loans"],
      columns: [],
      accessTypes: ["SELECT"],
      validUntil: futureDate(7),
      reason: "Аудит хийх",
    };

    it("throws BadRequestException for past validUntil", async () => {
      const past = new Date(Date.now() - 1000).toISOString();
      await expect(
        service.createRequest(REGULAR_USER, { ...validDto, validUntil: past }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException for validUntil > 90 days", async () => {
      const tooFar = futureDate(91);
      await expect(
        service.createRequest(REGULAR_USER, { ...validDto, validUntil: tooFar }),
      ).rejects.toThrow(BadRequestException);
    });

    it("succeeds for valid date and returns id", async () => {
      ch.query.mockResolvedValueOnce([]); // no overlapping grants
      const result = await service.createRequest(REGULAR_USER, validDto);
      expect(result).toHaveProperty("id");
      expect(ch.insert).toHaveBeenCalledWith(
        "access_requests",
        expect.arrayContaining([
          expect.objectContaining({
            tables: validDto.tables,
            status: "pending",
          }),
        ]),
      );
    });

    it("pre-revokes overlapping active grants before creating request", async () => {
      ch.query.mockResolvedValueOnce([
        {
          id: "grant-1",
          requestId: "req-old",
          userId: "user-1",
          userUserId: "nyamaa",
          requesterUserId: "nyamaa",
          tableName: "FINACLE.loans",
          isActive: 1,
          columns: "[]",
          accessTypes: "[]",
          validUntil: futureDate(3),
        },
      ]);
      await service.createRequest(REGULAR_USER, validDto);
      expect(chAccess.revokeAccess).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: "req-old" }),
      );
    });
  });

  // ── reviewRequest ─────────────────────────────────────────────────────────

  describe("reviewRequest", () => {
    const BASE_REQ = {
      id: "req-1",
      requesterId: "user-1",
      requesterName: "Нямаа",
      requesterUserId: "nyamaa",
      tables: JSON.stringify(["FINACLE.loans"]),
      columns: JSON.stringify([]),
      accessTypes: JSON.stringify(["SELECT"]),
      validUntil: futureDate(7),
      status: "pending",
    };

    it("throws NotFoundException when request not found", async () => {
      ch.query.mockResolvedValueOnce([]);
      await expect(
        service.reviewRequest("req-missing", ADMIN_USER, { action: "approve" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException when request already reviewed", async () => {
      ch.query.mockResolvedValueOnce([{ ...BASE_REQ, status: "approved" }]);
      await expect(
        service.reviewRequest("req-1", ADMIN_USER, { action: "approve" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when approving expired request (L-8)", async () => {
      const expiredReq = {
        ...BASE_REQ,
        validUntil: new Date(Date.now() - 1000).toISOString(),
      };
      ch.query.mockResolvedValueOnce([expiredReq]);
      await expect(
        service.reviewRequest("req-1", ADMIN_USER, { action: "approve" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a request without calling setupUserAndRole", async () => {
      ch.query.mockResolvedValueOnce([BASE_REQ]);
      await service.reviewRequest("req-1", ADMIN_USER, { action: "reject" });
      expect(chAccess.setupUserAndRole).not.toHaveBeenCalled();
      expect(ch.insert).toHaveBeenCalledWith(
        "access_requests",
        expect.arrayContaining([
          expect.objectContaining({ status: "rejected" }),
        ]),
      );
    });

    it("approves a pending request and calls setupUserAndRole + grantTableToRole", async () => {
      ch.query.mockResolvedValueOnce([BASE_REQ]);
      await service.reviewRequest("req-1", ADMIN_USER, { action: "approve" });
      expect(chAccess.setupUserAndRole).toHaveBeenCalled();
      expect(chAccess.grantTableToRole).toHaveBeenCalled();
    });
  });

  // ── access control ────────────────────────────────────────────────────────

  describe("canGrantAccess (via getPendingRequests)", () => {
    it("regular user without db_access_granter tool gets ForbiddenException", async () => {
      await expect(service.getPendingRequests(REGULAR_USER)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("admin user can get pending requests", async () => {
      ch.query.mockResolvedValueOnce([]);
      await expect(service.getPendingRequests(ADMIN_USER)).resolves.toEqual([]);
    });

    it("user with db_access_granter tool can get pending requests", async () => {
      ch.query.mockResolvedValueOnce([]);
      await expect(
        service.getPendingRequests(GRANTER_USER),
      ).resolves.toEqual([]);
    });
  });
});
