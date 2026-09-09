import { describe, it, expect } from "vitest";
import { ForbiddenException, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ToolGuard } from "./tool.guard";
import { AdminGuard } from "./admin.guard";
import { SuperAdminGuard } from "./super-admin.guard";

/**
 * Эрхийн guard-ууд бол системийн ЖИНХЭНЭ хамгаалалт — UI болон proxy нь
 * зөвхөн тав тухын давхарга. Тиймээс дүрэм бүрийг тестээр бэхлэнэ.
 */

/** Хамгийн бага ExecutionContext хуурмаг — guard-ууд зөвхөн req.user уншина. */
function ctx(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

/** `@RequireTools(...)` metadata-г буцаадаг Reflector хуурмаг. */
function reflectorWith(tools: string[] | undefined): Reflector {
  return {
    getAllAndOverride: () => tools,
  } as unknown as Reflector;
}

describe("ToolGuard", () => {
  it("шаардлагатай tool заагаагүй бол чөлөөтэй нэвтрүүлнэ", () => {
    const guard = new ToolGuard(reflectorWith(undefined));
    expect(guard.canActivate(ctx({ allowedTools: [] }))).toBe(true);
  });

  it("хоосон жагсаалт заасан бол ч чөлөөтэй", () => {
    const guard = new ToolGuard(reflectorWith([]));
    expect(guard.canActivate(ctx({ allowedTools: [] }))).toBe(true);
  });

  it("нэвтрээгүй (user байхгүй) бол татгалзана", () => {
    const guard = new ToolGuard(reflectorWith(["zainii_audit_rpt"]));
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });

  it("шаардлагатай tool байвал нэвтрүүлнэ", () => {
    const guard = new ToolGuard(reflectorWith(["zainii_audit_rpt"]));
    expect(
      guard.canActivate(ctx({ allowedTools: ["pivot", "zainii_audit_rpt"] })),
    ).toBe(true);
  });

  it("шаардлагатай tool байхгүй бол татгалзана", () => {
    const guard = new ToolGuard(reflectorWith(["zainii_audit_rpt"]));
    expect(() => guard.canActivate(ctx({ allowedTools: ["pivot"] }))).toThrow(
      ForbiddenException,
    );
  });

  it("ЯМАР НЭГ нь таарвал хангалттай (OR логик)", () => {
    const guard = new ToolGuard(
      reflectorWith(["zainii_audit_rpt", "zainii_audit_expense"]),
    );
    expect(
      guard.canActivate(ctx({ allowedTools: ["zainii_audit_expense"] })),
    ).toBe(true);
  });

  it("админ бүх tool-ыг тойрно", () => {
    const guard = new ToolGuard(reflectorWith(["zainii_audit_rpt"]));
    expect(guard.canActivate(ctx({ isAdmin: true, allowedTools: [] }))).toBe(
      true,
    );
  });

  it("супер админ мөн адил тойрно", () => {
    const guard = new ToolGuard(reflectorWith(["zainii_audit_rpt"]));
    expect(
      guard.canActivate(ctx({ isSuperAdmin: true, allowedTools: [] })),
    ).toBe(true);
  });

  it("allowedTools JSON мөр хэлбэрээр ирсэн ч ажиллана", () => {
    // ClickHouse-аас String багана болж ирдэг тохиолдол
    const guard = new ToolGuard(reflectorWith(["zainii_audit_rpt"]));
    expect(
      guard.canActivate(ctx({ allowedTools: '["zainii_audit_rpt","pivot"]' })),
    ).toBe(true);
  });

  it("гэмтэлтэй JSON мөрийг эрхгүйд тооцно (аюулгүй тал руу)", () => {
    const guard = new ToolGuard(reflectorWith(["zainii_audit_rpt"]));
    expect(() =>
      guard.canActivate(ctx({ allowedTools: "{ эвдэрсэн" })),
    ).toThrow(ForbiddenException);
  });

  it("allowedTools огт байхгүй бол татгалзана", () => {
    const guard = new ToolGuard(reflectorWith(["zainii_audit_rpt"]));
    expect(() => guard.canActivate(ctx({ name: "Ажилтан" }))).toThrow(
      ForbiddenException,
    );
  });
});

describe("AdminGuard", () => {
  const guard = new AdminGuard();

  it("админыг нэвтрүүлнэ", () => {
    expect(guard.canActivate(ctx({ isAdmin: true }))).toBe(true);
  });

  it("супер админыг нэвтрүүлнэ", () => {
    expect(guard.canActivate(ctx({ isSuperAdmin: true }))).toBe(true);
  });

  it("энгийн хэрэглэгчийг татгалзана", () => {
    expect(() => guard.canActivate(ctx({ isAdmin: false }))).toThrow(
      ForbiddenException,
    );
  });

  it("нэвтрээгүй бол татгалзана", () => {
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });
});

describe("SuperAdminGuard", () => {
  const guard = new SuperAdminGuard();

  it("супер админыг нэвтрүүлнэ", () => {
    expect(guard.canActivate(ctx({ isSuperAdmin: true }))).toBe(true);
  });

  it("ЭНГИЙН АДМИНЫГ ТАТГАЛЗАНА — энэ нь AdminGuard-аас ялгарах гол цэг", () => {
    // Зайны аудит / python-api / oracle тохиргоо зэрэг нь superadmin-only.
    expect(() =>
      guard.canActivate(ctx({ isAdmin: true, isSuperAdmin: false })),
    ).toThrow(ForbiddenException);
  });

  it("энгийн хэрэглэгчийг татгалзана", () => {
    expect(() => guard.canActivate(ctx({}))).toThrow(ForbiddenException);
  });

  it("нэвтрээгүй бол татгалзана", () => {
    expect(() => guard.canActivate(ctx(null))).toThrow(ForbiddenException);
  });
});
