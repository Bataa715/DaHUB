import { Test, TestingModule } from "@nestjs/testing";
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { UsersController } from "../src/users/users.controller";
import { UsersService } from "../src/users/users.service";
import { AuditLogService } from "../src/audit/audit-log.service";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUsersService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  getAdmins: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  updateTools: jest.fn(),
  setAdminRole: jest.fn(),
  resetPassword: jest.fn(),
  remove: jest.fn(),
  getAvatar: jest.fn(),
};

const mockAuditLogService = {
  log: jest.fn().mockResolvedValue(undefined),
};

const REGULAR_USER = {
  id: "user-123",
  isAdmin: false,
  isSuperAdmin: false,
};

const ADMIN_USER = {
  id: "admin-456",
  isAdmin: true,
  isSuperAdmin: false,
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("UsersController", () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();
    controller = module.get<UsersController>(UsersController);
  });

  afterEach(() => jest.clearAllMocks());

  // ── findOne (IDOR guard) ─────────────────────────────────────────────────

  describe("findOne", () => {
    it("allows user to view own profile", async () => {
      mockUsersService.findOne.mockResolvedValueOnce({ id: "user-123" });
      const req = { user: REGULAR_USER };
      await expect(
        controller.findOne("user-123", req),
      ).resolves.toEqual({ id: "user-123" });
    });

    it("throws ForbiddenException when non-admin reads another user", () => {
      const req = { user: REGULAR_USER };
      expect(() => controller.findOne("other-user", req)).toThrow(
        ForbiddenException,
      );
    });

    it("allows admin to view any profile", async () => {
      mockUsersService.findOne.mockResolvedValueOnce({ id: "other-user" });
      const req = { user: ADMIN_USER };
      await expect(
        controller.findOne("other-user", req),
      ).resolves.toEqual({ id: "other-user" });
    });
  });

  // ── updateTools (whitelist guard) ────────────────────────────────────────

  describe("updateTools", () => {
    it("allows valid tools", async () => {
      mockUsersService.updateTools.mockResolvedValueOnce({ id: "user-123" });
      await expect(
        controller.updateTools("user-123", { allowedTools: ["tailan", "chess"] }),
      ).resolves.toBeDefined();
    });

    it("throws BadRequestException for non-array body", () => {
      expect(() =>
        controller.updateTools("user-123", { allowedTools: "tailan" as any }),
      ).toThrow(BadRequestException);
    });

    it("throws BadRequestException for unknown tool names", () => {
      expect(() =>
        controller.updateTools("user-123", {
          allowedTools: ["tailan", "god_mode"],
        }),
      ).toThrow(BadRequestException);
    });
  });

  // ── getAvatar (IDOR guard) ───────────────────────────────────────────────

  describe("getAvatar", () => {
    const mockRes: any = {
      set: jest.fn(),
      send: jest.fn(),
    };

    it("throws ForbiddenException when non-admin requests another user avatar", async () => {
      const req = { user: REGULAR_USER };
      await expect(
        controller.getAvatar("other-user", mockRes, req),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws NotFoundException when avatar not found", async () => {
      mockUsersService.getAvatar.mockResolvedValueOnce(null);
      const req = { user: REGULAR_USER };
      await expect(
        controller.getAvatar("user-123", mockRes, req),
      ).rejects.toThrow(NotFoundException);
    });

    it("serves own avatar", async () => {
      mockUsersService.getAvatar.mockResolvedValueOnce({
        buffer: Buffer.from("img"),
        mimeType: "image/jpeg",
      });
      const req = { user: REGULAR_USER };
      await controller.getAvatar("user-123", mockRes, req);
      expect(mockRes.send).toHaveBeenCalled();
    });
  });
});
