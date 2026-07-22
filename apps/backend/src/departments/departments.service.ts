import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { CreateDepartmentDto, UpdateDepartmentDto } from "./dto/department.dto";
import { randomUUID } from "crypto";
import { buildUserId, WEB_VISIBLE_USER_SQL } from "../common/utils/user-utils";

@Injectable()
export class DepartmentsService {
  constructor(private clickhouse: ClickHouseService) {}

  async create(createDepartmentDto: CreateDepartmentDto) {
    const existing = await this.clickhouse.query<any>(
      "SELECT id FROM departments WHERE name = {name:String} LIMIT 1",
      { name: createDepartmentDto.name },
    );

    if (existing.length > 0) {
      throw new ConflictException("Ийм нэртэй хэлтэс аль хэдийн байна");
    }

    const id = randomUUID();
    await this.clickhouse.insert("departments", [
      {
        id,
        name: createDepartmentDto.name,
        description: createDepartmentDto.description || "",
        manager: createDepartmentDto.manager || "",
        code: (createDepartmentDto.code || "").toUpperCase(),
        createdAt: nowCH(),
        updatedAt: nowCH(),
      },
    ]);

    const result = await this.clickhouse.query<any>(
      "SELECT * FROM departments WHERE id = {id:String} LIMIT 1",
      { id },
    );
    return result[0];
  }

  async findAll() {
    const departments = await this.clickhouse.query<any>(
      "SELECT * FROM departments ORDER BY createdAt DESC",
    );
    if (departments.length === 0) return [];

    // [MED-5] N+1 fix — one query for ALL departments' users instead of one
    // query per department (previously `departments.length` sequential
    // round-trips to ClickHouse).
    const allUsers = await this.clickhouse.query<any>(
      `SELECT id, userId, name, position, isActive, profileImage, departmentId
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

    const fields: string[] = [];
    const params: Record<string, any> = { id };

    if (updateDepartmentDto.name !== undefined) {
      fields.push("name = {name:String}");
      params.name = updateDepartmentDto.name;
    }
    if (updateDepartmentDto.description !== undefined) {
      fields.push("description = {description:String}");
      params.description = updateDepartmentDto.description;
    }
    if (updateDepartmentDto.manager !== undefined) {
      fields.push("manager = {manager:String}");
      params.manager = updateDepartmentDto.manager;
    }
    const newCode =
      updateDepartmentDto.code !== undefined
        ? (updateDepartmentDto.code || "").toUpperCase()
        : undefined;
    if (newCode !== undefined) {
      fields.push("code = {code:String}");
      params.code = newCode;
    }

    if (fields.length > 0) {
      fields.push("updatedAt = {updatedAt:String}");
      params.updatedAt = nowCH();
      await this.clickhouse.exec(
        `ALTER TABLE departments UPDATE ${fields.join(", ")} WHERE id = {id:String} SETTINGS mutations_sync = 1`,
        params,
      );
    }

    const finalName = updateDepartmentDto.name ?? department.name;
    const oldCode = String(department.code ?? "");

    // Хэлтсийн ID prefix (code) өөрчлөгдвөл тухайн хэлтсийн бүх ажилтны
    // userId-г шинэ prefix-тэй дахин үүсгэнэ (нэр, ID-г гараар оруулсан бол хэвээр үлдээнэ).
    if (newCode !== undefined && newCode !== oldCode) {
      await this.resyncUserIdsForDepartment(id, finalName, newCode);
    }

    const updated = await this.clickhouse.query<any>(
      "SELECT * FROM departments WHERE id = {id:String} LIMIT 1",
      { id },
    );
    return updated[0];
  }

  /**
   * Хэлтсийн ID prefix (code) өөрчлөгдөх үед тухайн хэлтсийн бүх ажилтны
   * userId-г шинэ prefix ашиглан дахин тооцоолж шинэчилнэ.
   */
  private async resyncUserIdsForDepartment(
    departmentId: string,
    departmentName: string,
    newCode: string,
  ) {
    const users = await this.clickhouse.query<any>(
      "SELECT id, name, userId FROM users WHERE departmentId = {deptId:String}",
      { deptId: departmentId },
    );

    for (const user of users) {
      const newUserId = buildUserId(departmentName, user.name, newCode);
      if (newUserId === user.userId) continue;
      await this.clickhouse.exec(
        `ALTER TABLE users UPDATE userId = {userId:String}, updatedAt = {updatedAt:String}
         WHERE id = {id:String} SETTINGS mutations_sync = 1`,
        { userId: newUserId, updatedAt: nowCH(), id: user.id },
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
