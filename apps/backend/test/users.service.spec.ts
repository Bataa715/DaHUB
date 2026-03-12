import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { UsersService } from "../src/users/users.service";
import { ClickHouseService } from "../src/clickhouse/clickhouse.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClickhouse() {
  return {
    query: jest.fn(),
    insert: jest.fn().mockResolvedValue(undefined),
    exec: jest.fn().mockResolvedValue(undefined),
  };
}

const BASE_USER = {
  id: "user-123",
  userId: "DAG-EAH-Bold",
  name: "Болд",
  position: "Менежер",
  profileImage: "",
  departmentName: "Удирдлага",
  departmentId: "dept-1",
  isAdmin: 0,
  isSuperAdmin: 0,
  isActive: 1,
  allowedTools: '["tailan"]',
  lastLoginAt: null,
  createdAt: "2024-01-01 00:00:00",
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("UsersService", () => {
  let service: UsersService;
  let ch: ReturnType<typeof makeClickhouse>;

  beforeEach(async () => {
    ch = makeClickhouse();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: ClickHouseService, useValue: ch },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("returns mapped user list", async () => {
      ch.query.mockResolvedValueOnce([BASE_USER]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("user-123");
      expect(result[0].isAdmin).toBe(false);
      expect(result[0].allowedTools).toEqual(["tailan"]);
    });

    it("safely parses corrupt allowedTools as empty array", async () => {
      ch.query.mockResolvedValueOnce([
        { ...BASE_USER, allowedTools: "[invalid json" },
      ]);
      const result = await service.findAll();
      expect(result[0].allowedTools).toEqual([]);
    });

    it("returns empty list when no users", async () => {
      ch.query.mockResolvedValueOnce([]);
      const result = await service.findAll();
      expect(result).toEqual([]);
    });

    it("handles allowedTools as pre-parsed array", async () => {
      ch.query.mockResolvedValueOnce([
        { ...BASE_USER, allowedTools: ["chess"] },
      ]);
      const result = await service.findAll();
      expect(result[0].allowedTools).toEqual(["chess"]);
    });
  });

  // ── findOne ─────────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("returns user by id", async () => {
      ch.query.mockResolvedValueOnce([BASE_USER]);
      const user = await service.findOne("user-123");
      expect(user.id).toBe("user-123");
      expect(user.name).toBe("Болд");
    });

    it("throws NotFoundException when user missing", async () => {
      ch.query.mockResolvedValueOnce([]);
      await expect(service.findOne("missing")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── resetPassword ───────────────────────────────────────────────────────────

  describe("resetPassword", () => {
    it("throws BadRequestException if password too short", async () => {
      await expect(service.resetPassword("user-123", "Ab1!")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws BadRequestException if password lacks complexity", async () => {
      await expect(
        service.resetPassword("user-123", "alllowercase1!"),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws NotFoundException when user does not exist", async () => {
      ch.query.mockResolvedValueOnce([]); // user lookup → not found
      await expect(
        service.resetPassword("missing", "ValidPass1!"),
      ).rejects.toThrow(NotFoundException);
    });

    it("hashes password and updates record", async () => {
      ch.query.mockResolvedValueOnce([BASE_USER]);
      const result = await service.resetPassword("user-123", "ValidPass1!");
      expect(result.message).toContain("амжилттай");
      expect(ch.exec).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE"),
        expect.objectContaining({ id: "user-123" }),
      );
    });
  });

  // ── getAvatar ───────────────────────────────────────────────────────────────

  describe("getAvatar", () => {
    it("returns null when no profile image", async () => {
      ch.query.mockResolvedValueOnce([{ profileImage: "" }]);
      expect(await service.getAvatar("user-123")).toBeNull();
    });

    it("returns null for disallowed MIME type (SVG)", async () => {
      ch.query.mockResolvedValueOnce([
        {
          profileImage:
            "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=",
        },
      ]);
      expect(await service.getAvatar("user-123")).toBeNull();
    });

    it("returns buffer and mimeType for valid JPEG data URL", async () => {
      const b64 = Buffer.from("fake-image-bytes").toString("base64");
      ch.query.mockResolvedValueOnce([
        { profileImage: `data:image/jpeg;base64,${b64}` },
      ]);
      const result = await service.getAvatar("user-123");
      expect(result).not.toBeNull();
      expect(result!.mimeType).toBe("image/jpeg");
      expect(Buffer.isBuffer(result!.buffer)).toBe(true);
    });
  });

  // ── updateTools ─────────────────────────────────────────────────────────────

  describe("updateTools", () => {
    it("stores tools as JSON and returns updated user", async () => {
      ch.query.mockResolvedValueOnce([BASE_USER]); // user exists check
      ch.query.mockResolvedValueOnce([BASE_USER]); // re-fetch after update
      await service.updateTools("user-123", ["tailan", "chess"]);
      expect(ch.exec).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE"),
        expect.objectContaining({
          allowedTools: JSON.stringify(["tailan", "chess"]),
        }),
      );
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("throws NotFoundException when user missing", async () => {
      ch.query.mockResolvedValueOnce([]);
      await expect(service.remove("missing")).rejects.toThrow(NotFoundException);
    });

    it("soft-deletes then hard-deletes user", async () => {
      ch.query.mockResolvedValueOnce([{ id: "user-123" }]);
      await service.remove("user-123");
      // exec called at least twice: soft-delete and hard-delete
      expect(ch.exec).toHaveBeenCalledTimes(2);
    });
  });
});
