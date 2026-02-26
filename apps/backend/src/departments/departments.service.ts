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
  constructor(private clickhouse: ClickHouseService) {
    this.ensurePhotosTable();
  }

  private async ensurePhotosTable() {
    try {
      await this.clickhouse.exec(`
        CREATE TABLE IF NOT EXISTS department_photos (
          id String,
          departmentId String,
          departmentName String,
          uploadedBy String,
          uploadedByName String,
          imageData String,
          caption String DEFAULT '',
          uploadedAt DateTime DEFAULT now()
        ) ENGINE = MergeTree() ORDER BY (departmentId, uploadedAt)
      `);
    } catch (e) {
      console.error("Failed to ensure department_photos table:", e);
    }
  }

  async getPhotos(departmentId: string) {
    return this.clickhouse.query<any>(
      `SELECT id, departmentId, departmentName, uploadedBy, uploadedByName, caption, imageData, uploadedAt
       FROM department_photos WHERE departmentId = {deptId:String}
       ORDER BY uploadedAt DESC`,
      { deptId: departmentId },
    );
  }

  async getPhotoData(photoId: string) {
    const rows = await this.clickhouse.query<any>(
      `SELECT imageData FROM department_photos WHERE id = {id:String} LIMIT 1`,
      { id: photoId },
    );
    if (!rows || rows.length === 0)
      throw new NotFoundException("Зураг олдсонгүй");
    return rows[0];
  }

  async uploadPhoto(
    departmentId: string,
    departmentName: string,
    uploadedBy: string,
    uploadedByName: string,
    imageData: string,
    caption = "",
  ) {
    const id = randomUUID();
    const now = nowCH();
    await this.clickhouse.insert("department_photos", [
      {
        id,
        departmentId,
        departmentName,
        uploadedBy,
        uploadedByName,
        imageData,
        caption,
        uploadedAt: now,
      },
    ]);
    return { id, message: "Зураг амжилттай нэмэгдлээ" };
  }

  async deletePhoto(photoId: string) {
    await this.clickhouse.exec(
      `ALTER TABLE department_photos DELETE WHERE id = {id:String}`,
      { id: photoId },
    );
    return { message: "Зураг устгагдлаа" };
  }

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
        "SELECT id, userId, name, position, isActive, profileImage FROM users WHERE departmentId = {deptId:String}",
        { deptId: dept.id },
      );
      result.push({ ...dept, users });
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
      "SELECT id, userId, name, position, isActive, profileImage FROM users WHERE departmentId = {id:String}",
      { id },
    );

    return { ...department, users };
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
