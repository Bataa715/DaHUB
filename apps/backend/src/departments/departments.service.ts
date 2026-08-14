import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { UpdateDepartmentDto } from "./dto/department.dto";
import { buildUserId, WEB_VISIBLE_USER_SQL } from "../common/utils/user-utils";
import { DEPARTMENT_CODES } from "../common/constants/departments";
import { UserFacingBadRequestException } from "../common/exceptions/user-facing.exception";

@Injectable()
export class DepartmentsService implements OnModuleInit {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(private clickhouse: ClickHouseService) {}

  async onModuleInit() {
    await this.seedDefaultDepartments();
  }

  /**
   * Эхлэхэд байгууллагын үндсэн хэлтэс/албуудыг (DEPARTMENT_CODES) байхгүй бол
   * автоматаар үүсгэнэ — admin хэлтэс хуудас анхнаасаа дүүрэн байхын тулд.
   * Idempotent: аль хэдийн байгаа нэрийг давхардуулахгүй. createdAt-ийг канон
   * дарааллаар (ORDER BY createdAt DESC үед Удирдлага эхэлж) тааруулна.
   */
  private async seedDefaultDepartments(): Promise<void> {
    try {
      const existing = await this.clickhouse.query<{ name: string }>(
        "SELECT name FROM departments",
      );
      const existingNames = new Set(existing.map((d) => String(d.name)));
      const names = Object.keys(DEPARTMENT_CODES);
      const missing = names.filter((n) => !existingNames.has(n));
      if (missing.length === 0) return;

      const baseMs = Date.now();
      const rows = missing.map((name) => {
        const canonicalIdx = names.indexOf(name);
        const ts = new Date(baseMs + (names.length - canonicalIdx) * 1000);
        return {
          id: randomUUID(),
          name,
          description: "",
          manager: "",
          code: DEPARTMENT_CODES[name],
          createdAt: ts.toISOString().slice(0, 19).replace("T", " "),
          updatedAt: nowCH(),
        };
      });
      await this.clickhouse.insert("departments", rows);
      this.logger.log(
        `Үндсэн хэлтэс seed хийсэн: ${rows.map((r) => r.name).join(", ")}`,
      );
    } catch (e) {
      this.logger.error(
        `seedDefaultDepartments алдаа: ${(e as Error)?.message ?? e}`,
      );
    }
  }

  async findAll() {
    const departments = await this.clickhouse.query<any>(
      "SELECT * FROM departments ORDER BY createdAt DESC",
    );
    if (departments.length === 0) return [];

    // [MED-5] N+1 fix — one query for ALL departments' users instead of one
    // query per department (previously `departments.length` sequential
    // round-trips to ClickHouse).
    // [PERF] profileImage-ийг (base64, нэг бүр 7MB хүртэл) энд ТАТАХГҮЙ — өмнө нь
    // ажилтан бүрийн бүтэн зургийг оруулснаас employee directory хэдэн арван MB
    // болж prod дээр маш удаан ачаалагддаг байв. Оронд нь hasProfileImage туг л
    // буцаана; аватарыг frontend нь /users/:id/avatar-аас lazy, кэштэйгээр татна.
    const allUsers = await this.clickhouse.query<any>(
      `SELECT id, userId, name, position, isActive, departmentId,
              if(profileImage != '', 1, 0) AS hasProfileImage
       FROM users
       WHERE departmentId IN {deptIds:Array(String)}
         AND ${WEB_VISIBLE_USER_SQL}`,
      { deptIds: departments.map((d: { id: string }) => d.id) },
    );
    const usersByDept = new Map<string, any[]>();
    for (const u of allUsers) {
      const list = usersByDept.get(u.departmentId);
      if (list) list.push(u);
      else usersByDept.set(u.departmentId, [u]);
    }

    return departments.map((dept: any) => {
      const users = usersByDept.get(dept.id) ?? [];

      // manager талбар буруу (System Admin г.м.) байвал албан тушаалаар захирлыг олно
      let manager = String(dept.manager ?? "").trim();
      const managerLooksInvalid =
        !manager || /system\s*admin/i.test(manager) || /^admin$/i.test(manager);
      if (managerLooksInvalid) {
        const director = users.find((u: { position?: string }) => {
          const pos = String(u.position ?? "").toLowerCase();
          if (String(dept.name ?? "").includes("Удирдлага")) {
            return pos.includes("захирал");
          }
          return pos.includes("хэлтсийн захирал") || pos.includes("захирал");
        });
        if (director) manager = String(director.name ?? "");
      }

      return { ...dept, manager, users };
    });
  }

  async update(id: string, updateDepartmentDto: UpdateDepartmentDto) {
    const departments = await this.clickhouse.query<any>(
      "SELECT * FROM departments WHERE id = {id:String} LIMIT 1",
      { id },
    );

    if (departments.length === 0) {
      throw new NotFoundException("Хэлтэс олдсонгүй");
    }

    const department = departments[0];

    if (
      updateDepartmentDto.name &&
      updateDepartmentDto.name !== department.name
    ) {
      const existing = await this.clickhouse.query<any>(
        "SELECT id FROM departments WHERE name = {name:String} AND id != {id:String} LIMIT 1",
        { name: updateDepartmentDto.name, id },
      );
      if (existing.length > 0) {
        throw new ConflictException("Ийм нэртэй хэлтэс аль хэдийн байна");
      }
    }

    // ClickHouse-д MySQL-ийн UPDATE privilege байхгүй — ALTER UPDATE mutation
    // зарим орчинд хориглогдсон байдаг. INSERT + ALTER DELETE ажилладаг тул
    // update-ийг DELETE → INSERT (row replace) хэлбэрээр хийнэ.
    const newCode =
      updateDepartmentDto.code !== undefined
        ? (updateDepartmentDto.code || "").toUpperCase()
        : undefined;

    const nextRow = {
      id: department.id,
      name: updateDepartmentDto.name ?? department.name,
      description:
        updateDepartmentDto.description !== undefined
          ? updateDepartmentDto.description
          : (department.description ?? ""),
      manager:
        updateDepartmentDto.manager !== undefined
          ? updateDepartmentDto.manager
          : (department.manager ?? ""),
      code: newCode !== undefined ? newCode : String(department.code ?? ""),
      createdAt: department.createdAt,
      updatedAt: nowCH(),
    };

    try {
      await this.clickhouse.replaceRows(
        "departments",
        "id = {id:String}",
        { id },
        [nextRow],
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Department update failed: ${msg}`);
      if (/Not enough privileges|ACCESS_DENIED|Code:\s*497/i.test(msg)) {
        throw new UserFacingBadRequestException(
          "ClickHouse дээр хэлтэс засах эрх хүрэлцэхгүй байна (ALTER DELETE / INSERT шаардлагатай)",
        );
      }
      throw err;
    }

    const finalName = String(nextRow.name);
    const oldCode = String(department.code ?? "");

    // Хэлтсийн ID prefix (code) өөрчлөгдвөл тухайн хэлтсийн бүх ажилтны
    // userId-г шинэ prefix-тэй дахин үүсгэнэ.
    if (newCode !== undefined && newCode !== oldCode) {
      await this.resyncUserIdsForDepartment(id, finalName, newCode);
    }

    return nextRow;
  }

  /**
   * Хэлтсийн ID prefix (code) өөрчлөгдөх үед тухайн хэлтсийн бүх ажилтны
   * userId-г шинэ prefix ашиглан дахин тооцоолж шинэчилнэ.
   * ALTER UPDATE биш — DELETE + INSERT (row replace).
   */
  private async resyncUserIdsForDepartment(
    departmentId: string,
    departmentName: string,
    newCode: string,
  ) {
    const users = await this.clickhouse.query<any>(
      "SELECT * FROM users WHERE departmentId = {deptId:String}",
      { deptId: departmentId },
    );

    for (const user of users) {
      const newUserId = buildUserId(
        departmentName,
        user.name,
        newCode,
        user.position,
      );
      if (newUserId === user.userId) continue;

      const nextUser = {
        id: user.id,
        userId: newUserId,
        password: user.password ?? "",
        name: user.name ?? "",
        position: user.position ?? "",
        profileImage: user.profileImage ?? "",
        departmentId: user.departmentId ?? departmentId,
        isAdmin: Number(user.isAdmin) || 0,
        isSuperAdmin: Number(user.isSuperAdmin) || 0,
        isActive: user.isActive === undefined ? 1 : Number(user.isActive),
        allowedTools:
          typeof user.allowedTools === "string"
            ? user.allowedTools
            : JSON.stringify(user.allowedTools ?? []),
        grantableTools:
          typeof user.grantableTools === "string"
            ? user.grantableTools
            : JSON.stringify(user.grantableTools ?? []),
        lastLoginAt: user.lastLoginAt ?? null,
        createdAt: user.createdAt,
        updatedAt: nowCH(),
      };

      await this.clickhouse.replaceRows(
        "users",
        "id = {id:String}",
        { id: user.id },
        [nextUser],
      );
    }
  }

  async remove(id: string) {
    const departments = await this.clickhouse.query<any>(
      "SELECT * FROM departments WHERE id = {id:String} LIMIT 1",
      { id },
    );

    if (departments.length === 0) {
      throw new NotFoundException("Хэлтэс олдсонгүй");
    }

    const users = await this.clickhouse.query<any>(
      "SELECT id FROM users WHERE departmentId = {id:String}",
      { id },
    );

    if (users.length > 0) {
      throw new ConflictException(
        "Энэ хэлтэст ажилтнууд байна. Эхлээд тэднийг шилжүүлнэ үү",
      );
    }

    await this.clickhouse.exec(
      "ALTER TABLE departments DELETE WHERE id = {id:String}",
      { id },
    );
    return { message: "Хэлтсийг амжилттай устгалаа" };
  }
}
