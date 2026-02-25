import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException, ConflictException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import { AuditLogService } from "../audit/audit-log.service";
import * as bcrypt from "bcryptjs";

describe("AuthService", () => {
  let service: AuthService;
  let clickHouseService: jest.Mocked<ClickHouseService>;
  let jwtService: jest.Mocked<JwtService>;
  let auditLogService: jest.Mocked<AuditLogService>;

  const mockUser = {
    id: "user-123",
    userId: "DAG-EAH-Bold",
    password: "$2a$10$epZ8zMek9GMHMgnunuc46Ooc6CkPmHNUkTEnmV7tjUyrRVpXNC9r6", // hashed "Password123!"
    name: "Болд",
    department: "Удирдлага",
    position: "Менежер",
    isAdmin: false,
    isActive: true,
    createdAt: new Date(),
  };

  const mockAdminUser = {
    ...mockUser,
    id: "admin-456",
    userId: "ADM-001-Admin",
    name: "Admin User",
    isAdmin: true,
  };

  const mockDepartment = {
    id: "dept-123",
    name: "Удирдлага",
    prefix: "DAG",
    description: "Management department",
  };

  beforeEach(async () => {
    const mockClickHouseService = {
      query: jest.fn(),
      insert: jest.fn(),
      exec: jest.fn().mockResolvedValue(undefined),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue("mock-jwt-token"),
      verify: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === "JWT_SECRET") return "test-secret";
        return null;
      }),
    };

    const mockAuditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ClickHouseService,
          useValue: mockClickHouseService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    clickHouseService = module.get(ClickHouseService);
    jwtService = module.get(JwtService);
    auditLogService = module.get(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("login", () => {
    it("should successfully login with valid credentials", async () => {
      clickHouseService.query
        .mockResolvedValueOnce([mockDepartment] as any) // findOne department
        .mockResolvedValueOnce([mockUser] as any); // findOne user
      clickHouseService.insert.mockResolvedValueOnce(undefined);

      const loginDto = {
        department: "Удирдлага",
        username: "Болд",
        password: "Password123!",
      };

      const result = await service.login(loginDto);

      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result.user.name).toBe("Болд");
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          action: "login",
          status: "success",
        }),
      );
    });

    it("should throw UnauthorizedException for invalid department", async () => {
      clickHouseService.query.mockResolvedValueOnce([] as any); // No department

      const loginDto = {
        department: "InvalidDept",
        username: "Болд",
        password: "Password123!",
      };

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException for invalid username", async () => {
      clickHouseService.query
        .mockResolvedValueOnce([mockDepartment] as any)
        .mockResolvedValueOnce([] as any); // No user

      const loginDto = {
        department: "Удирдлага",
        username: "InvalidUser",
        password: "Password123!",
      };

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException for invalid password", async () => {
      clickHouseService.query
        .mockResolvedValueOnce([mockDepartment] as any)
        .mockResolvedValueOnce([mockUser] as any);

      const loginDto = {
        department: "Удирдлага",
        username: "Болд",
        password: "WrongPassword123!",
      };

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("loginById", () => {
    it("should successfully login with valid userId and password", async () => {
      clickHouseService.query.mockResolvedValueOnce([mockUser] as any);
      clickHouseService.insert.mockResolvedValueOnce(undefined);

      const loginByIdDto = {
        userId: "DAG-EAH-Bold",
        password: "Password123!",
      };

      const result = await service.loginById(loginByIdDto);

      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result.user.userId).toBe("DAG-EAH-Bold");
    });

    it("should throw UnauthorizedException for invalid userId", async () => {
      clickHouseService.query.mockResolvedValueOnce([] as any);

      const loginByIdDto = {
        userId: "INVALID-ID",
        password: "Password123!",
      };

      await expect(service.loginById(loginByIdDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException for invalid password", async () => {
      clickHouseService.query.mockResolvedValueOnce([mockUser] as any);

      const loginByIdDto = {
        userId: "DAG-EAH-Bold",
        password: "WrongPassword123!",
      };

      await expect(service.loginById(loginByIdDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("adminLogin", () => {
    it("should successfully login admin with valid credentials", async () => {
      clickHouseService.query.mockResolvedValueOnce([mockAdminUser] as any);
      clickHouseService.insert.mockResolvedValueOnce(undefined);

      const adminLoginDto = {
        username: "ADM-001-Admin",
        password: "Password123!",
      };

      const result = await service.adminLogin(adminLoginDto);

      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result.user.isAdmin).toBe(true);
    });

    it("should throw UnauthorizedException for non-admin user", async () => {
      clickHouseService.query.mockResolvedValueOnce([] as any); // Query filters non-admin

      const adminLoginDto = {
        username: "DAG-EAH-Bold",
        password: "Password123!",
      };

      await expect(service.adminLogin(adminLoginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException for invalid credentials", async () => {
      clickHouseService.query.mockResolvedValueOnce([] as any);

      const adminLoginDto = {
        username: "invalid-user",
        password: "Password123!",
      };

      await expect(service.adminLogin(adminLoginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("checkUser", () => {
    it("should return { exists: true } if user exists", async () => {
      clickHouseService.query.mockResolvedValueOnce([mockUser] as any);

      const checkUserDto = { userId: "DAG-EAH-Bold" };
      const result = await service.checkUser(checkUserDto);

      expect(result.exists).toBe(true);
      expect(result.userId).toBe("DAG-EAH-Bold");
      expect(clickHouseService.query).toHaveBeenCalled();
    });

    it("should return { exists: false } if user does not exist", async () => {
      clickHouseService.query.mockResolvedValueOnce([] as any);

      const checkUserDto = { userId: "NONEXISTENT" };
      const result = await service.checkUser(checkUserDto);

      expect(result.exists).toBe(false);
      expect(result.userId).toBeNull();
    });
  });

  describe("registerUser", () => {
    const registerDto = {
      department: "Удирдлага",
      position: "Менежер",
      name: "Бат",
    };

    it("should successfully register a new user", async () => {
      clickHouseService.query
        .mockResolvedValueOnce([] as any) // Check if generated userId exists (.Бат-DAG)
        .mockResolvedValueOnce([mockDepartment] as any); // ensureDepartment
      clickHouseService.insert.mockResolvedValueOnce(undefined); // user insert

      const result = await service.registerUser(registerDto);

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("userId");
      expect(result).toHaveProperty("message");
      expect(result.name).toBe("Бат");
    });

    it("should throw ConflictException if user already exists", async () => {
      const existingUserId = ".Бат-DAG";
      clickHouseService.query.mockResolvedValueOnce([
        { id: "existing", userId: existingUserId },
      ] as any); // User exists

      await expect(service.registerUser(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("setPassword", () => {
    it("should successfully set password for user", async () => {
      const userWithoutPassword = { ...mockUser, password: "PENDING_PASSWORD" };
      clickHouseService.query.mockResolvedValueOnce([
        userWithoutPassword,
      ] as any);

      const setPasswordDto = {
        userId: "DAG-EAH-Bold",
        password: "NewPassword123!",
      };

      const result = await service.setPassword(setPasswordDto);

      expect(result).toHaveProperty("success", true);
      expect(clickHouseService.exec).toHaveBeenCalled();
    });

    it("should throw error if user not found", async () => {
      clickHouseService.query.mockResolvedValueOnce([] as any);

      const setPasswordDto = {
        userId: "NONEXISTENT",
        password: "NewPassword123!",
      };

      await expect(service.setPassword(setPasswordDto)).rejects.toThrow();
    });

    it("should throw error if user already has real password", async () => {
      clickHouseService.query.mockResolvedValueOnce([mockUser] as any);

      const setPasswordDto = {
        userId: "DAG-EAH-Bold",
        password: "NewPassword123!",
      };

      await expect(service.setPassword(setPasswordDto)).rejects.toThrow();
    });
  });

  describe("changePassword", () => {
    it("should successfully change password with valid old password", async () => {
      clickHouseService.query.mockResolvedValueOnce([mockUser] as any);

      const changePasswordDto = {
        currentPassword: "Password123!",
        newPassword: "NewPassword456!",
      };

      const result = await service.changePassword(
        mockUser.id,
        changePasswordDto,
      );

      expect(result).toHaveProperty("success", true);
      expect(clickHouseService.exec).toHaveBeenCalled();
    });

    it("should throw UnauthorizedException for invalid old password", async () => {
      clickHouseService.query.mockResolvedValueOnce([mockUser] as any);

      const changePasswordDto = {
        currentPassword: "WrongPassword123!",
        newPassword: "NewPassword456!",
      };

      await expect(
        service.changePassword(mockUser.id, changePasswordDto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw error if user not found", async () => {
      clickHouseService.query.mockResolvedValueOnce([] as any);

      const changePasswordDto = {
        currentPassword: "Password123!",
        newPassword: "NewPassword456!",
      };

      await expect(
        service.changePassword("nonexistent-id", changePasswordDto),
      ).rejects.toThrow();
    });
  });

  describe("validateUser", () => {
    it("should return user data for valid userId", async () => {
      clickHouseService.query.mockResolvedValueOnce([mockUser] as any);

      const result = await service.validateUser(mockUser.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockUser.id);
      expect(clickHouseService.query).toHaveBeenCalled();
    });

    it("should return null for non-existent user", async () => {
      clickHouseService.query.mockResolvedValueOnce([] as any);

      const result = await service.validateUser("nonexistent-id");

      expect(result).toBeNull();
    });

    it("should return user even if inactive (JWT validation)", async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      clickHouseService.query.mockResolvedValueOnce([inactiveUser] as any);

      const result = await service.validateUser(mockUser.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockUser.id);
    });
  });

  describe("refreshAccessToken", () => {
    const mockRefreshToken = "valid-refresh-token";
    const mockStoredToken = {
      id: "token-123",
      userId: mockUser.id,
      token: mockRefreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isRevoked: false,
    };

    it("should successfully refresh access token with valid refresh token", async () => {
      clickHouseService.query
        .mockResolvedValueOnce([mockStoredToken] as any)
        .mockResolvedValueOnce([mockUser] as any)
        .mockResolvedValueOnce([] as any); // Revoke old token
      clickHouseService.insert.mockResolvedValueOnce(undefined); // Insert new token

      const result = await service.refreshAccessToken({
        refreshToken: mockRefreshToken,
      });

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result.refreshToken).not.toBe(mockRefreshToken);
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it("should throw UnauthorizedException for invalid refresh token", async () => {
      clickHouseService.query.mockResolvedValueOnce([] as any);

      await expect(
        service.refreshAccessToken({ refreshToken: "invalid-token" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for expired refresh token", async () => {
      // Query filters out expired tokens with 'expiresAt > now()'
      clickHouseService.query.mockResolvedValueOnce([] as any);

      await expect(
        service.refreshAccessToken({ refreshToken: mockRefreshToken }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for revoked refresh token", async () => {
      // Query filters out revoked tokens with 'isRevoked = 0'
      clickHouseService.query.mockResolvedValueOnce([] as any);

      await expect(
        service.refreshAccessToken({ refreshToken: mockRefreshToken }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("revokeRefreshTokens", () => {
    it("should successfully revoke all refresh tokens for user", async () => {
      await service.revokeRefreshTokens(mockUser.id);

      expect(clickHouseService.exec).toHaveBeenCalledWith(
        expect.stringContaining(
          "ALTER TABLE refresh_tokens UPDATE isRevoked = 1",
        ),
        expect.objectContaining({ userId: mockUser.id }),
      );
    });

    it("should throw error if database fails", async () => {
      clickHouseService.exec.mockRejectedValueOnce(new Error("Database error"));

      await expect(service.revokeRefreshTokens(mockUser.id)).rejects.toThrow(
        "Database error",
      );
    });
  });
});
