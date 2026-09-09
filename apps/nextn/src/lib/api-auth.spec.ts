import { describe, it, expect } from "vitest";
import {
  isAdminPayload,
  isSuperAdminPayload,
  parseAllowedTools,
  hasToolAccess,
  isSameOriginRequest,
} from "./api-auth";

/**
 * Next-ийн Route Handler (`app/api/**`) доторх эрхийн шалгалт.
 *
 * `proxy.ts` нь `/api/*` замуудыг эргэн шилжилтээс хасдаг тул эдгээр route
 * бүр өөрөө нэвтрэлт/эрхээ шалгах ёстой — доорх функцууд тэр шалгалтын цөм.
 */

describe("parseAllowedTools", () => {
  it("массивыг шууд буцаана", () => {
    expect(parseAllowedTools(["pivot", "tailan"])).toEqual(["pivot", "tailan"]);
  });

  it("JSON мөрийг задална (ClickHouse String багана)", () => {
    expect(parseAllowedTools('["pivot","tailan"]')).toEqual([
      "pivot",
      "tailan",
    ]);
  });

  it("массивын элементийг мөр болгоно", () => {
    expect(parseAllowedTools([1, 2])).toEqual(["1", "2"]);
  });

  it("JSON биш ганц мөрийг нэг элемент гэж үзнэ", () => {
    expect(parseAllowedTools("pivot")).toEqual(["pivot"]);
  });

  it("хоосон утгуудад хоосон массив", () => {
    expect(parseAllowedTools(null)).toEqual([]);
    expect(parseAllowedTools(undefined)).toEqual([]);
    expect(parseAllowedTools("")).toEqual([]);
    expect(parseAllowedTools("   ")).toEqual([]);
  });

  it("JSON нь массив биш бол хоосон", () => {
    expect(parseAllowedTools('{"a":1}')).toEqual([]);
  });
});

describe("isAdminPayload / isSuperAdminPayload", () => {
  it("boolean true-г хүлээн авна", () => {
    expect(isAdminPayload({ isAdmin: true })).toBe(true);
    expect(isSuperAdminPayload({ isSuperAdmin: true })).toBe(true);
  });

  it("ClickHouse-ийн UInt8 1-ийг хүлээн авна", () => {
    expect(isAdminPayload({ isAdmin: 1 })).toBe(true);
    expect(isSuperAdminPayload({ isSuperAdmin: 1 })).toBe(true);
  });

  it("супер админ нь админд ч тооцогдоно", () => {
    expect(isAdminPayload({ isSuperAdmin: true })).toBe(true);
  });

  it("энгийн админ нь супер админ БИШ", () => {
    // Зайны аудит / python-api зэрэг нь superadmin-only тул энэ чухал.
    expect(isSuperAdminPayload({ isAdmin: true })).toBe(false);
  });

  it("null payload бол үгүй", () => {
    expect(isAdminPayload(null)).toBe(false);
    expect(isSuperAdminPayload(null)).toBe(false);
  });

  it("0 / false / мөр '1' нь эрх ОЛГОХГҮЙ", () => {
    expect(isAdminPayload({ isAdmin: 0 })).toBe(false);
    expect(isAdminPayload({ isAdmin: false })).toBe(false);
    expect(isAdminPayload({ isAdmin: "1" })).toBe(false);
  });
});

describe("hasToolAccess", () => {
  it("эрх байвал зөвшөөрнө", () => {
    expect(
      hasToolAccess({ allowedTools: ["zainii_audit_rpt"] }, [
        "zainii_audit_rpt",
      ]),
    ).toBe(true);
  });

  it("аль нэг нь таарвал хангалттай (OR)", () => {
    expect(
      hasToolAccess({ allowedTools: ["zainii_audit_expense"] }, [
        "zainii_audit_rpt",
        "zainii_audit_expense",
      ]),
    ).toBe(true);
  });

  it("эрхгүй бол татгалзана", () => {
    expect(
      hasToolAccess({ allowedTools: ["pivot"] }, ["zainii_audit_rpt"]),
    ).toBe(false);
  });

  it("админ бүх tool-ыг тойрно", () => {
    expect(hasToolAccess({ isAdmin: true, allowedTools: [] }, ["x"])).toBe(
      true,
    );
  });

  it("payload байхгүй бол татгалзана", () => {
    expect(hasToolAccess(null, ["zainii_audit_rpt"])).toBe(false);
  });

  it("JSON мөр хэлбэрийн allowedTools-ыг дэмжинэ", () => {
    expect(
      hasToolAccess({ allowedTools: '["zainii_audit_rpt"]' }, [
        "zainii_audit_rpt",
      ]),
    ).toBe(true);
  });
});

describe("isSameOriginRequest (CSRF)", () => {
  const req = (headers: Record<string, string>) =>
    new Request("https://dahub.golomtbank.local/api/x", { headers });

  it("Sec-Fetch-Site: cross-site бол ТАТГАЛЗАНА", () => {
    expect(isSameOriginRequest(req({ "sec-fetch-site": "cross-site" }))).toBe(
      false,
    );
  });

  it("Sec-Fetch-Site: same-origin бол зөвшөөрнө", () => {
    expect(isSameOriginRequest(req({ "sec-fetch-site": "same-origin" }))).toBe(
      true,
    );
  });

  it("Origin нь host-той таарвал зөвшөөрнө", () => {
    expect(
      isSameOriginRequest(
        req({
          origin: "https://dahub.golomtbank.local",
          host: "dahub.golomtbank.local",
        }),
      ),
    ).toBe(true);
  });

  it("Origin нь өөр host бол татгалзана", () => {
    expect(
      isSameOriginRequest(
        req({
          origin: "https://evil.example.com",
          host: "dahub.golomtbank.local",
        }),
      ),
    ).toBe(false);
  });

  it("x-forwarded-host-ыг харгалзана (reverse proxy)", () => {
    expect(
      isSameOriginRequest(
        req({
          origin: "https://dahub.golomtbank.local",
          "x-forwarded-host": "dahub.golomtbank.local",
          host: "internal-node:9002",
        }),
      ),
    ).toBe(true);
  });

  it("Origin байхгүй бол зөвшөөрнө (curl / server-to-server)", () => {
    // Эдгээрийг cookie-ийн нэвтрэлт давхар хамгаална.
    expect(isSameOriginRequest(req({}))).toBe(true);
  });

  it("гэмтэлтэй Origin-ийг татгалзана", () => {
    expect(
      isSameOriginRequest(
        req({ origin: "not-a-valid-url", host: "dahub.golomtbank.local" }),
      ),
    ).toBe(false);
  });
});
