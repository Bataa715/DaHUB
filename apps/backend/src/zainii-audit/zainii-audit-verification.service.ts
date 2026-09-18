import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { ClickHouseService } from "../clickhouse/clickhouse.service";
import {
  ExpenseVerificationDto,
  CreateVerificationTypeDto,
  UpdateVerificationTypeDto,
  HamaaralVerificationDto,
} from "./dto/zainii-audit.dto";
import { nowCH } from "../clickhouse/clickhouse.service";
import {
  ExpenseVerificationRow,
  ExpenseVerificationTypeRow,
} from "./zainii-audit.types";

export interface HamaaralVerificationRow {
  cif: string;
  empid: string;
  typename: string;
  verifiedStatus: string;
  updatedBy: string;
  updatedByName: string;
  updatedAt: string;
}

/** Зардлын гүйлгээний аудиторын баталгаажуулалт ба баталгаажуулалтын төрлийн лавлах. */
@Injectable()
export class ZainiiAuditVerificationService {
  constructor(private readonly clickhouse: ClickHouseService) {}

  // ── Verification types (admin-managed) ──────────────────────────────────
  async listVerificationTypes(
    activeOnly: boolean,
  ): Promise<ExpenseVerificationTypeRow[]> {
    return this.clickhouse.query<ExpenseVerificationTypeRow>(
      `SELECT id, name, isActive FROM expense_verification_types FINAL
       ${activeOnly ? "WHERE isActive = 1" : ""}
       ORDER BY name
       LIMIT 500`,
    );
  }

  async createVerificationType(
    dto: CreateVerificationTypeDto,
  ): Promise<ExpenseVerificationTypeRow> {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException("Төрлийн нэр хоосон байж болохгүй");
    }
    const dup = await this.clickhouse.query<{ id: string }>(
      `SELECT id FROM expense_verification_types FINAL
       WHERE name = {name:String} LIMIT 1`,
      { name },
    );
    if (dup[0]) {
      throw new BadRequestException("Ийм нэртэй төрөл аль хэдийн байна");
    }
    const id = randomUUID();
    const now = nowCH();
    await this.clickhouse.insert("expense_verification_types", [
      { id, name, isActive: 1, createdAt: now, updatedAt: now },
    ]);
    return { id, name, isActive: 1 };
  }

  async updateVerificationType(
    id: string,
    dto: UpdateVerificationTypeDto,
  ): Promise<ExpenseVerificationTypeRow> {
    const existing = await this.clickhouse.query<
      ExpenseVerificationTypeRow & { createdAt: string }
    >(
      `SELECT * FROM expense_verification_types FINAL WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    const current = existing[0];
    if (!current) {
      throw new NotFoundException("Төрөл олдсонгүй");
    }
    const name =
      dto.name !== undefined ? dto.name.trim() || current.name : current.name;
    const isActive: 0 | 1 =
      dto.isActive !== undefined ? (dto.isActive ? 1 : 0) : current.isActive;

    await this.clickhouse.insert("expense_verification_types", [
      {
        id,
        name,
        isActive,
        createdAt: current.createdAt,
        updatedAt: nowCH(),
      },
    ]);
    return { id, name, isActive };
  }

  async deleteVerificationType(id: string): Promise<{ success: true }> {
    const existing = await this.clickhouse.query<{ id: string }>(
      `SELECT id FROM expense_verification_types FINAL WHERE id = {id:String} LIMIT 1`,
      { id },
    );
    if (!existing[0]) {
      throw new NotFoundException("Төрөл олдсонгүй");
    }
    await this.clickhouse.exec(
      `ALTER TABLE expense_verification_types DELETE WHERE id = {id:String}`,
      { id },
    );
    return { success: true };
  }

  async upsertVerification(
    dto: ExpenseVerificationDto,
    user: { userId: string; name: string },
  ): Promise<ExpenseVerificationRow> {
    if (
      dto.comment === undefined &&
      dto.verificationType === undefined &&
      dto.contractTotalAmount === undefined &&
      dto.contractDate === undefined &&
      dto.contractNumber === undefined &&
      dto.remainingAmount === undefined &&
      dto.status === undefined &&
      dto.contractCurrency === undefined &&
      dto.budgetStatusOverride === undefined &&
      dto.authorityMatrixViolated === undefined &&
      dto.authorityMatrixComment === undefined
    ) {
      throw new BadRequestException(
        "Тайлбар, төрөл, гэрээний дүн/дугаар/огноо/валют, үлдэгдэл төлбөр, статус, төсвийн төлөв, эрхийн матрицын аль нэгийг дамжуулна уу",
      );
    }

    const existing = await this.clickhouse.query<ExpenseVerificationRow>(
      `SELECT * FROM avlaga_verifications FINAL WHERE bookNumber = {bookNumber:String} LIMIT 1`,
      { bookNumber: dto.bookNumber },
    );
    const current = existing[0];

    const row: ExpenseVerificationRow = {
      bookNumber: dto.bookNumber,
      comment:
        dto.comment !== undefined ? dto.comment : (current?.comment ?? ""),
      verificationType:
        dto.verificationType !== undefined
          ? dto.verificationType
          : (current?.verificationType ?? ""),
      contractTotalAmount:
        dto.contractTotalAmount !== undefined
          ? dto.contractTotalAmount
          : (current?.contractTotalAmount ?? 0),
      contractDate:
        dto.contractDate !== undefined
          ? dto.contractDate
          : (current?.contractDate ?? ""),
      contractNumber:
        dto.contractNumber !== undefined
          ? dto.contractNumber
          : (current?.contractNumber ?? ""),
      remainingAmount:
        dto.remainingAmount !== undefined
          ? dto.remainingAmount
          : (current?.remainingAmount ?? 0),
      status: dto.status !== undefined ? dto.status : (current?.status ?? ""),
      contractCurrency:
        dto.contractCurrency !== undefined
          ? dto.contractCurrency
          : (current?.contractCurrency ?? "MNT"),
      budgetStatusOverride:
        dto.budgetStatusOverride !== undefined
          ? dto.budgetStatusOverride
          : (current?.budgetStatusOverride ?? ""),
      authorityMatrixViolated:
        dto.authorityMatrixViolated !== undefined
          ? dto.authorityMatrixViolated
            ? 1
            : 0
          : (current?.authorityMatrixViolated ?? 0),
      authorityMatrixComment:
        dto.authorityMatrixComment !== undefined
          ? dto.authorityMatrixComment
          : (current?.authorityMatrixComment ?? ""),
      updatedBy: user.userId,
      updatedByName: user.name,
      updatedAt: nowCH(),
    };

    await this.clickhouse.insert("avlaga_verifications", [{ ...row }]);
    return row;
  }

  /** Хамааралтай (hamaaral) харилцагчийн мэдээллийг аудитор баталгаажуулах
   *  (Батлагдсан/Нотлогдоогүй) — (cif, empid, typename) хослолоор өвөрмөц. */
  async upsertHamaaralVerification(
    dto: HamaaralVerificationDto,
    user: { userId: string; name: string },
  ): Promise<HamaaralVerificationRow> {
    const row: HamaaralVerificationRow = {
      cif: dto.cif,
      empid: dto.empid,
      typename: dto.typename,
      verifiedStatus: dto.status,
      updatedBy: user.userId,
      updatedByName: user.name,
      updatedAt: nowCH(),
    };
    await this.clickhouse.insert("hamaaral_verifications", [{ ...row }]);
    return row;
  }
}
