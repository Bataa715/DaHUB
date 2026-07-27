import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import * as bcrypt from "bcryptjs";
import { VALID_TOOLS_SET } from "../common/constants/tools";
import {
  buildUserId,
  safeParseTools,
  webVisibleUserSql,
  isPrivilegedUser,
} from "../common/utils/user-utils";

// [LOW-1] buildUserId and safeParseTools moved to src/common/utils/user-utils.ts

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private clickhouse: ClickHouseService) {}

  async findAll(limit = 1000, offset = 0, excludeAdmins = false) {
    const adminFilter = excludeAdmins ? `WHERE ${webVisibleUserSql("u")}` : "";
    const users = await this.clickhouse.query<any>(
      `SELECT u.*, d.name as departmentName
       FROM users u LEFT JOIN departments d ON u.departmentId = d.id
       ${adminFilter}
       ORDER BY u.createdAt DESC
       LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
      { limit, offset },
    );

    return users.map((user) => ({
      id: user.id,
      userId: user.userId,
      name: user.name,
      position: user.position,
      profileImage: user.profileImage,
      department: user.departmentName,
      departmentId: user.departmentId,
      isAdmin: !!user.isAdmin,
      isSuperAdmin: !!user.isSuperAdmin,
      isActive: !!user.isActive,
      allowedTools: safeParseTools(user.allowedTools),
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    }));
  }

  async findOne(id: string) {
    const users = await this.clickhouse.query<any>(
      `SELECT u.*, d.name as departmentName
       FROM users u LEFT JOIN departments d ON u.departmentId = d.id
       WHERE u.id = {id:String} LIMIT 1`,
      { id },
    );

    const user = users[0];
    if (!user) {
      throw new NotFoundException("Хэрэглэгч олдсонгүй");
    }

    return {
      id: user.id,
      userId: user.userId,
      name: user.name,
      position: user.position,
      profileImage: user.profileImage,
      department: user.departmentName,
      departmentId: user.departmentId,
      isAdmin: !!user.isAdmin,
      isSuperAdmin: !!user.isSuperAdmin,
      allowedTools: safeParseTools(user.allowedTools),
      createdAt: user.createdAt,
    };
  }

  async getAdmins() {
    const users = await this.clickhouse.query<any>(
      `SELECT u.id, u.userId, u.name, u.departmentId, u.isAdmin, u.isSuperAdmin, u.isActive,
              u.grantableTools, u.createdAt, d.name AS departmentName
       FROM users u
       LEFT JOIN departments d ON u.departmentId = d.id
       WHERE u.isAdmin = 1
       ORDER BY u.createdAt ASC`,
    );
    return users.map((user) => ({
      id: user.id,
      userId: user.userId,
      name: user.name,
      department: user.departmentName ?? null,
      isAdmin: !!user.isAdmin,
      isSuperAdmin: !!user.isSuperAdmin,
      isActive: !!user.isActive,
      grantableTools: safeParseTools(user.grantableTools),
      createdAt: user.createdAt,
    }));
  }

  /** Normalize a users-table row for INSERT (DELETE+INSERT replace). */
  private buildUserRow(
    existing: Record<string, any>,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      id: existing.id,
      userId: existing.userId,
      password: existing.password ?? "",
      name: existing.name ?? "",
      position: existing.position ?? "",
      profileImage: existing.profileImage ?? "",
      departmentId: existing.departmentId ?? "",
      isAdmin: Number(existing.isAdmin) || 0,
      isSuperAdmin: Number(existing.isSuperAdmin) || 0,
      isActive:
        existing.isActive === undefined ? 1 : Number(existing.isActive),
      allowedTools:
        typeof existing.allowedTools === "string"
          ? existing.allowedTools
          : JSON.stringify(existing.allowedTools ?? []),
      grantableTools:
        typeof existing.grantableTools === "string"
          ? existing.grantableTools
          : JSON.stringify(existing.grantableTools ?? []),
      lastLoginAt: existing.lastLoginAt ?? null,
      createdAt: existing.createdAt,
      updatedAt: nowCH(),
      ...overrides,
    };
  }

  private async replaceUser(
    id: string,
    existing: Record<string, any>,
    overrides: Record<string, unknown> = {},
  ) {
    await this.clickhouse.replaceRows(
      "users",
      "id = {id:String}",
      { id },
      [this.buildUserRow(existing, overrides)],
    );
  }

  async setAdminRole(
    id: string,
    isAdmin: boolean,
    isSuperAdmin: boolean,
    grantableTools?: string[],
  ) {
    const users = await this.clickhouse.query<any>(
      "SELECT * FROM users WHERE id = {id:String} LIMIT 1",
      { id },
    );
    if (users.length === 0) throw new NotFoundException("Хэрэглэгч олдсонгүй");

    // [H-5] Only persist known-valid tool names (see common/constants/tools.ts)
    const sanitizedTools = (grantableTools ?? []).filter((t) =>
      VALID_TOOLS_SET.has(t),
    );
    const toolsJson = JSON.stringify(sanitizedTools);

    await this.replaceUser(id, users[0], {
      isAdmin: isAdmin ? 1 : 0,
      isSuperAdmin: isSuperAdmin ? 1 : 0,
      grantableTools: toolsJson,
      // Админ болгоход хэлтэсээс салгана — веб дээр харагдахгүй
      ...(isAdmin ? { departmentId: "" } : {}),
    });

    return {
      message: "Амжилттай",
      id,
      isAdmin,
      isSuperAdmin,
      grantableTools: sanitizedTools,
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const users = await this.clickhouse.query<any>(
      "SELECT * FROM users WHERE id = {id:String} LIMIT 1",
      { id },
    );

    if (users.length === 0) {
      throw new NotFoundException("Хэрэглэгч олдсонгүй");
    }

    const existing = users[0];
    const isPrivileged = !!existing.isAdmin || !!existing.isSuperAdmin;

    let nextName = updateUserDto.name ?? existing.name;
    let nextPosition =
      updateUserDto.position !== undefined
        ? updateUserDto.position
        : (existing.position ?? "");
    let nextUserId =
      updateUserDto.userId !== undefined
        ? updateUserDto.userId
        : existing.userId;
    let nextDepartmentId =
      updateUserDto.departmentId !== undefined
        ? updateUserDto.departmentId
        : (existing.departmentId ?? "");
    let nextProfileImage =
      updateUserDto.profileImage !== undefined
        ? updateUserDto.profileImage
        : (existing.profileImage ?? "");
    let nextAllowedTools =
      updateUserDto.allowedTools !== undefined
        ? JSON.stringify(updateUserDto.allowedTools)
        : typeof existing.allowedTools === "string"
          ? existing.allowedTools
          : JSON.stringify(existing.allowedTools ?? []);

    if (updateUserDto.departmentId !== undefined) {
      if (isPrivileged) {
        throw new BadRequestException(
          "Админ хэрэглэгчийг хэлтэст оноох боломжгүй",
        );
      }

      // Auto-generate userId only when not explicitly provided
      if (updateUserDto.userId === undefined) {
        const depts = await this.clickhouse.query<any>(
          "SELECT name, code FROM departments WHERE id = {deptId:String} LIMIT 1",
          { deptId: updateUserDto.departmentId },
        );
        if (depts.length > 0) {
          const newDeptName = depts[0].name as string;
          const newDeptCode = (depts[0].code as string) || "";
          nextUserId = buildUserId(newDeptName, nextName, newDeptCode);
        }
      }
    }

    if (updateUserDto.profileImage !== undefined) {
      if (updateUserDto.profileImage.length > 7_000_000) {
        throw new BadRequestException(
          "Профайл зургийн хэмжээ хэт их байна (дээд тал нь 5MB)",
        );
      }
    }

    const hasChanges =
      updateUserDto.name !== undefined ||
      updateUserDto.position !== undefined ||
      updateUserDto.userId !== undefined ||
      updateUserDto.departmentId !== undefined ||
      updateUserDto.profileImage !== undefined ||
      updateUserDto.allowedTools !== undefined;

    if (hasChanges) {
      try {
        await this.replaceUser(id, existing, {
          userId: nextUserId,
          name: nextName,
          position: nextPosition,
          profileImage: nextProfileImage,
          departmentId: nextDepartmentId,
          allowedTools: nextAllowedTools,
        });
      } catch (error: unknown) {
        this.logger.error(
          `ClickHouse update error: ${error instanceof Error ? error.message : String(error)}`,
        );
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Хэрэглэгч шинэчлэхэд алдаа гарлаа: ${msg}`);
      }
    }

    const updated = await this.clickhouse.query<any>(
      `SELECT u.*, d.name as departmentName
       FROM users u LEFT JOIN departments d ON u.departmentId = d.id
       WHERE u.id = {id:String} LIMIT 1`,
      { id },
    );

    const user = updated[0];
    return {
      id: user.id,
      name: user.name,
      position: user.position,
      profileImage: user.profileImage,
      department: user.departmentName,
      departmentId: user.departmentId,
      isAdmin: !!user.isAdmin,
      allowedTools: safeParseTools(user.allowedTools),
    };
  }

  async clearProfileImage(id: string) {
    return this.update(id, { profileImage: "" });
  }

  /**
   * [H-6] A plain Admin (isAdmin=1, isSuperAdmin=0) must not be able to delete,
   * deactivate, or reset the password of another admin/superadmin — only a
   * SuperAdmin may manage privileged accounts. Regular users are unaffected.
   */
  private assertCanManageTarget(
    target: { isAdmin?: unknown; isSuperAdmin?: unknown },
    callerIsSuperAdmin: boolean,
  ): void {
    if (isPrivilegedUser(target) && !callerIsSuperAdmin) {
      throw new ForbiddenException(
        "Зөвхөн супер админ бусад админ хэрэглэгчийг удирдах боломжтой",
      );
    }
  }

  async remove(id: string, callerIsSuperAdmin: boolean) {
    const users = await this.clickhouse.query<any>(
      "SELECT id, isAdmin, isSuperAdmin FROM users WHERE id = {id:String} LIMIT 1",
      { id },
    );

    if (users.length === 0) {
      throw new NotFoundException("Хэрэглэгч олдсонгүй");
    }
    this.assertCanManageTarget(users[0], callerIsSuperAdmin);

    // Hard-delete synchronously — soft UPDATE isActive bypass (no ALTER UPDATE privilege)
    await this.clickhouse.exec(
      "ALTER TABLE users DELETE WHERE id = {id:String} SETTINGS mutations_sync = 1",
      { id },
    );
    return { message: "Хэрэглэгчийг амжилттай устгалаа" };
  }

  async updateTools(id: string, allowedTools: string[]) {
    const users = await this.clickhouse.query<any>(
      "SELECT * FROM users WHERE id = {id:String} LIMIT 1",
      { id },
    );

    if (users.length === 0) {
      throw new NotFoundException("Хэрэглэгч олдсонгүй");
    }

    if (isPrivilegedUser(users[0])) {
      throw new BadRequestException(
        "Админ хэрэглэгчид tool эрх олгох боломжгүй",
      );
    }

    await this.replaceUser(id, users[0], {
      allowedTools: JSON.stringify(allowedTools),
    });

    const updated = await this.clickhouse.query<any>(
      `SELECT u.*, d.name as departmentName
       FROM users u LEFT JOIN departments d ON u.departmentId = d.id
       WHERE u.id = {id:String} LIMIT 1`,
      { id },
    );

    const user = updated[0];
    return {
      id: user.id,
      name: user.name,
      allowedTools: safeParseTools(user.allowedTools),
    };
  }

  async resetPassword(
    id: string,
    newPassword: string,
    callerIsSuperAdmin: boolean,
  ) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException(
        "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой",
      );
    }
    const complexityRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+\[\]{}|;:',.<>\/~`])[A-Za-z\d@$!%*?&#^()\-_=+\[\]{}|;:',.<>\/~`]+$/;
    if (!complexityRegex.test(newPassword)) {
      throw new BadRequestException(
        "Нууц үг нь том үсэг, жижиг үсэг, тоо, тусгай тэмдэгт агуулсан байх ёстой",
      );
    }
    const users = await this.clickhouse.query<any>(
      "SELECT * FROM users WHERE id = {id:String} LIMIT 1",
      { id },
    );
    if (users.length === 0) throw new NotFoundException("Хэрэглэгч олдсонгүй");
    this.assertCanManageTarget(users[0], callerIsSuperAdmin);
    const hashed = await bcrypt.hash(newPassword, 13);
    await this.replaceUser(id, users[0], { password: hashed });
    this.logger.warn(
      `Password reset by admin for user: ${users[0].userId} (${users[0].name})`,
    );
    return {
      message: "Нууц үг амжилттай сэргээлээ",
      userId: users[0].userId,
      name: users[0].name,
    };
  }
}
