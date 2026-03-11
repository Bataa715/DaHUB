import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import * as bcrypt from "bcryptjs";

// Mirrors auth.service.ts DEPARTMENT_CODES — keep in sync
const DEPARTMENT_CODES: Record<string, string> = {
  Удирдлага: "DAG",
  "Дата анализын алба": "DAA",
  "Ерөнхий аудитын хэлтэс": "EAH",
  "Зайны аудит чанарын баталгаажуулалтын хэлтэс": "ZACHBH",
  "Мэдээллийн технологийн аудитын хэлтэс": "MTAH",
};

function buildUserId(department: string, name: string): string {
  const deptCode = DEPARTMENT_CODES[department] || "USR";
  const namePart = name
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("-")
    .replace(/\s+/g, "");
  if (department === "Удирдлага") return `.${namePart}-${deptCode}`;
  if (department === "Дата анализын алба") return `${deptCode}-${namePart}`;
  return `DAG-${deptCode}-${namePart}`;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private clickhouse: ClickHouseService) {}

  async findAll(limit = 200, offset = 0) {
    const users = await this.clickhouse.query<any>(
      `SELECT u.*, d.name as departmentName
       FROM users u LEFT JOIN departments d ON u.departmentId = d.id
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
      allowedTools: user.allowedTools ? JSON.parse(user.allowedTools) : [],
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
      allowedTools: user.allowedTools ? JSON.parse(user.allowedTools) : [],
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
      grantableTools: user.grantableTools
        ? JSON.parse(user.grantableTools)
        : [],
      createdAt: user.createdAt,
    }));
  }

  async setAdminRole(
    id: string,
    isAdmin: boolean,
    isSuperAdmin: boolean,
    grantableTools?: string[],
  ) {
    const users = await this.clickhouse.query<any>(
      "SELECT id FROM users WHERE id = {id:String} LIMIT 1",
      { id },
    );
    if (users.length === 0) throw new NotFoundException("Хэрэглэгч олдсонгүй");

    const toolsJson = JSON.stringify(grantableTools ?? []);

    await this.clickhouse.exec(
      `ALTER TABLE users UPDATE isAdmin = {isAdmin:UInt8}, isSuperAdmin = {isSuperAdmin:UInt8}, grantableTools = {grantableTools:String}, updatedAt = {updatedAt:String} WHERE id = {id:String}`,
      {
        id,
        isAdmin: isAdmin ? 1 : 0,
        isSuperAdmin: isSuperAdmin ? 1 : 0,
        grantableTools: toolsJson,
        updatedAt: nowCH(),
      },
    );
    return {
      message: "Амжилттай",
      id,
      isAdmin,
      isSuperAdmin,
      grantableTools: grantableTools ?? [],
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

    const fields: string[] = [];
    const params: Record<string, any> = { id };

    if (updateUserDto.name !== undefined) {
      fields.push("name = {name:String}");
      params.name = updateUserDto.name;
    }
    if (updateUserDto.position !== undefined) {
      fields.push("position = {position:String}");
      params.position = updateUserDto.position;
    }
    if (updateUserDto.userId !== undefined) {
      fields.push("userId = {userId:String}");
      params.userId = updateUserDto.userId;
    }
    if (updateUserDto.departmentId !== undefined) {
      fields.push("departmentId = {departmentId:String}");
      params.departmentId = updateUserDto.departmentId;

      // Auto-generate userId only when not explicitly provided
      if (updateUserDto.userId === undefined) {
        const depts = await this.clickhouse.query<any>(
          "SELECT name FROM departments WHERE id = {deptId:String} LIMIT 1",
          { deptId: updateUserDto.departmentId },
        );
        if (depts.length > 0) {
          const newDeptName = depts[0].name as string;
          const userName = (updateUserDto.name ?? users[0].name) as string;
          const newUserId = buildUserId(newDeptName, userName);
          fields.push("userId = {userId:String}");
          params.userId = newUserId;
        }
      }
    }
    if (updateUserDto.profileImage !== undefined) {
      // Guard against oversized base64 images (~5 MB limit)
      if (updateUserDto.profileImage.length > 7_000_000) {
        throw new BadRequestException("Профайл зургийн хэмжээ хэт их байна (дээд тал нь 5MB)");
      }
      fields.push("profileImage = {profileImage:String}");
      params.profileImage = updateUserDto.profileImage;
    }
    if (updateUserDto.allowedTools !== undefined) {
      fields.push("allowedTools = {allowedTools:String}");
      params.allowedTools = JSON.stringify(updateUserDto.allowedTools);
    }

    if (fields.length > 0) {
      fields.push("updatedAt = {updatedAt:String}");
      params.updatedAt = nowCH();

      try {
        await this.clickhouse.exec(
          `ALTER TABLE users UPDATE ${fields.join(", ")} WHERE id = {id:String}`,
          params,
        );
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
      allowedTools: user.allowedTools ? JSON.parse(user.allowedTools) : [],
    };
  }

  async remove(id: string) {
    const users = await this.clickhouse.query<any>(
      "SELECT id FROM users WHERE id = {id:String} LIMIT 1",
      { id },
    );

    if (users.length === 0) {
      throw new NotFoundException("Хэрэглэгч олдсонгүй");
    }

    // Soft-delete first so concurrent signup checks (AND isActive = 1) immediately
    // see this user as gone, even before the async hard-delete mutation completes.
    await this.clickhouse.exec(
      "ALTER TABLE users UPDATE isActive = 0 WHERE id = {id:String}",
      { id },
    );
    // Hard-delete (async mutation — physically removes the row eventually)
    await this.clickhouse.exec(
      "ALTER TABLE users DELETE WHERE id = {id:String}",
      { id },
    );
    return { message: "Хэрэглэгчийг амжилттай устгалаа" };
  }

  async updateStatus(id: string, isActive: boolean) {
    const users = await this.clickhouse.query<any>(
      "SELECT id FROM users WHERE id = {id:String} LIMIT 1",
      { id },
    );

    if (users.length === 0) {
      throw new NotFoundException("Хэрэглэгч олдсонгүй");
    }

    await this.clickhouse.exec(
      "ALTER TABLE users UPDATE isActive = {isActive:UInt8}, updatedAt = {updatedAt:String} WHERE id = {id:String}",
      {
        id,
        isActive: isActive ? 1 : 0,
        updatedAt: nowCH(),
      },
    );

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
      isActive: !!user.isActive,
      department: user.departmentName,
    };
  }

  async updateTools(id: string, allowedTools: string[]) {
    const users = await this.clickhouse.query<any>(
      "SELECT id FROM users WHERE id = {id:String} LIMIT 1",
      { id },
    );

    if (users.length === 0) {
      throw new NotFoundException("Хэрэглэгч олдсонгүй");
    }

    await this.clickhouse.exec(
      "ALTER TABLE users UPDATE allowedTools = {allowedTools:String}, updatedAt = {updatedAt:String} WHERE id = {id:String}",
      {
        id,
        allowedTools: JSON.stringify(allowedTools),
        updatedAt: nowCH(),
      },
    );

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
      allowedTools: user.allowedTools ? JSON.parse(user.allowedTools) : [],
    };
  }

  async resetPassword(id: string, newPassword: string) {
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
      "SELECT id, name, userId, isAdmin FROM users WHERE id = {id:String} LIMIT 1",
      { id },
    );
    if (users.length === 0) throw new NotFoundException("Хэрэглэгч олдсонгүй");
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.clickhouse.exec(
      "ALTER TABLE users UPDATE password = {password:String}, updatedAt = {updatedAt:String} WHERE id = {id:String}",
      { id, password: hashed, updatedAt: nowCH() },
    );
    this.logger.warn(
      `Password reset by superadmin for user: ${users[0].userId} (${users[0].name})`,
    );
    return {
      message: "Нууц үг амжилттай сэргээлээ",
      userId: users[0].userId,
      name: users[0].name,
    };
  }

  async getAvatar(
    id: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const users = await this.clickhouse.query<any>(
      "SELECT profileImage FROM users WHERE id = {id:String} LIMIT 1",
      { id },
    );
    const profileImage: string = users[0]?.profileImage;
    if (!profileImage) return null;

    // Expect a data URL: "data:<mime>;base64,<data>"
    const match = profileImage.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;

    // H-5: Whitelist MIME types — prevents Content-Type injection (stored XSS via SVG/HTML)
    const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_IMAGE_MIMES.includes(match[1])) return null;

    return { buffer: Buffer.from(match[2], "base64"), mimeType: match[1] };
  }
}
