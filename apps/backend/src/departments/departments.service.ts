import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { ClickHouseService, nowCH } from "../clickhouse/clickhouse.service";
import { CreateDepartmentDto, UpdateDepartmentDto } from "./dto/department.dto";
import { randomUUID } from "crypto";

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
        employeeCount: createDepartmentDto.employeeCount || 0,
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

    const result = [];
    for (const dept of departments) {
      const users = await this.clickhouse.query<any>(
        `SELECT id, userId, name, position, isActive, profileImage
         FROM users
         WHERE departmentId = {deptId:String}
           AND isAdmin = 0
           AND isSuperAdmin = 0
           AND lower(name) NOT LIKE '%system admin%'
           AND lower(name) NOT LIKE '%system%admin%'`,
        { deptId: dept.id },
      );

      // manager талбар буруу (System Admin г.м.) байвал албан тушаалаар захирлыг олно
      let manager = String(dept.manager ?? "").trim();
      const managerLooksInvalid =
        !manager ||
        /system\s*admin/i.test(manager) ||
        /^admin$/i.test(manager);
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

      result.push({ ...dept, manager, users });
    }

    return result;
  }

  async findOne(id: string) {
    const departments = await this.clickhouse.query<any>(
      "SELECT * FROM departments WHERE id = {id:String} LIMIT 1",
      { id },
    );

    if (departments.length === 0) {
      throw new NotFoundException("Хэлтэс олдсонгүй");
    }

    const department = departments[0];
    const users = await this.clickhouse.query<any>(
      `SELECT id, userId, name, position, isActive, profileImage
       FROM users
       WHERE departmentId = {id:String}
         AND isAdmin = 0
         AND isSuperAdmin = 0
         AND lower(name) NOT LIKE '%system admin%'
         AND lower(name) NOT LIKE '%system%admin%'`,
      { id },
    );

    let manager = String(department.manager ?? "").trim();
    const managerLooksInvalid =
      !manager ||
      /system\s*admin/i.test(manager) ||
      /^admin$/i.test(manager);
    if (managerLooksInvalid) {
      const director = users.find((u: { position?: string }) => {
        const pos = String(u.position ?? "").toLowerCase();
        if (String(department.name ?? "").includes("Удирдлага")) {
          return pos.includes("захирал");
        }
        return pos.includes("хэлтсийн захирал") || pos.includes("захирал");
      });
      if (director) manager = String(director.name ?? "");
    }

    return { ...department, manager, users };
  }

  async findByName(name: string) {
    const departments = await this.clickhouse.query<any>(
      "SELECT * FROM departments WHERE name = {name:String} LIMIT 1",
      { name },
    );

    if (departments.length === 0) {
      throw new NotFoundException("Хэлтэс олдсонгүй");
    }

    const department = departments[0];
    const users = await this.clickhouse.query<any>(
      "SELECT id, userId, name, position, profileImage FROM users WHERE departmentId = {deptId:String} AND isAdmin = 0",
      { deptId: department.id },
    );

    return { ...department, users };
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
        "SELECT id FROM departments WHERE name = {name:String} LIMIT 1",
        { name: updateDepartmentDto.name },
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
    if (updateDepartmentDto.employeeCount !== undefined) {
      fields.push("employeeCount = {employeeCount:UInt32}");
      params.employeeCount = updateDepartmentDto.employeeCount;
    }
    if (updateDepartmentDto.code !== undefined) {
      fields.push("code = {code:String}");
      params.code = (updateDepartmentDto.code || "").toUpperCase();
    }

    if (fields.length > 0) {
      fields.push("updatedAt = {updatedAt:String}");
      params.updatedAt = nowCH();
      await this.clickhouse.exec(
        `ALTER TABLE departments UPDATE ${fields.join(", ")} WHERE id = {id:String}`,
        params,
      );
    }

    const updated = await this.clickhouse.query<any>(
      "SELECT * FROM departments WHERE id = {id:String} LIMIT 1",
      { id },
    );
    return updated[0];
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
