import { Injectable, NotFoundException } from "@nestjs/common";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(private clickhouse: ClickHouseService) {}

  async findAll() {
    const users = await this.clickhouse.query<any>(
      `SELECT u.*, d.name as departmentName
       FROM users u LEFT JOIN departments d ON u.departmentId = d.id
       ORDER BY u.createdAt DESC`,
    );

    return users.map((user) => ({
      id: user.id,
      userId: user.userId,
      email: user.email,
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
      email: user.email,
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
      `SELECT * FROM users WHERE isAdmin = 1 ORDER BY createdAt ASC`,
    );
    return users.map((user) => ({
      id: user.id,
      userId: user.userId,
      name: user.name,
      department: user.department,
      isAdmin: !!user.isAdmin,
      isSuperAdmin: !!user.isSuperAdmin,
      isActive: !!user.isActive,
      createdAt: user.createdAt,
    }));
  }

  async setAdminRole(id: string, isAdmin: boolean, isSuperAdmin: boolean) {
    const users = await this.clickhouse.query<any>(
      'SELECT id FROM users WHERE id = {id:String} LIMIT 1',
      { id },
    );
    if (users.length === 0) throw new NotFoundException('Хэрэглэгч олдсонгүй');

    await this.clickhouse.exec(
      `ALTER TABLE users UPDATE isAdmin = {isAdmin:UInt8}, isSuperAdmin = {isSuperAdmin:UInt8}, updatedAt = {updatedAt:String} WHERE id = {id:String}`,
      {
        id,
        isAdmin: isAdmin ? 1 : 0,
        isSuperAdmin: isSuperAdmin ? 1 : 0,
        updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      },
    );
    return { message: 'Амжилттай', id, isAdmin, isSuperAdmin };
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
    if (updateUserDto.departmentId !== undefined) {
      fields.push("departmentId = {departmentId:String}");
      params.departmentId = updateUserDto.departmentId;
    }
    if (updateUserDto.profileImage !== undefined) {
      fields.push("profileImage = {profileImage:String}");
      params.profileImage = updateUserDto.profileImage;
    }
    if (updateUserDto.isAdmin !== undefined) {
      fields.push("isAdmin = {isAdmin:UInt8}");
      params.isAdmin = updateUserDto.isAdmin ? 1 : 0;
    }
    if (updateUserDto.allowedTools !== undefined) {
      fields.push("allowedTools = {allowedTools:String}");
      params.allowedTools = JSON.stringify(updateUserDto.allowedTools);
    }

    if (fields.length > 0) {
      fields.push("updatedAt = {updatedAt:String}");
      params.updatedAt = new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      try {
        await this.clickhouse.exec(
          `ALTER TABLE users UPDATE ${fields.join(", ")} WHERE id = {id:String}`,
          params,
        );
      } catch (error) {
        console.error("ClickHouse update error:", error);
        throw new Error(`Хэрэглэгч шинэчлэхэд алдаа гарлаа: ${error.message}`);
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
      email: user.email,
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
        updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
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
      email: user.email,
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
        updatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
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
      email: user.email,
      name: user.name,
      allowedTools: user.allowedTools ? JSON.parse(user.allowedTools) : [],
    };
  }
}
