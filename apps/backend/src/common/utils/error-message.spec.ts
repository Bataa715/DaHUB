import { describe, it, expect } from "vitest";
import { errMessage, errCode, errStack } from "./error-message";

/**
 * Энэ туслах нь backend-ийн 16 файлын `catch` блокт ашиглагддаг тул
 * ямар ч хэлбэрийн алдаанд уншигдахуйц мессеж буцаах ёстой — үгүй бол
 * лог "undefined" болж, алдааны мөрдөлт тасарна.
 */
describe("errMessage", () => {
  it("Error-ийн мессежийг авна", () => {
    expect(errMessage(new Error("холболт тасарлаа"))).toBe("холболт тасарлаа");
  });

  it("Nest-ийн HttpException мэт дэд классыг ч зөв уншина", () => {
    class HttpLike extends Error {}
    expect(errMessage(new HttpLike("403"))).toBe("403");
  });

  it("ClickHouse/Oracle драйверын энгийн объектоос message авна", () => {
    expect(errMessage({ message: "Cannot GET /x" })).toBe("Cannot GET /x");
  });

  it("message байхгүй бол type руу шилжинэ (ClickHouse ийм алдаа өгдөг)", () => {
    expect(errMessage({ type: "UNKNOWN_IDENTIFIER" })).toBe(
      "UNKNOWN_IDENTIFIER",
    );
  });

  it("message ба type хоёулаа байхгүй бол code руу шилжинэ", () => {
    expect(errMessage({ code: "ECONNRESET" })).toBe("ECONNRESET");
  });

  it("мөр шидсэн тохиолдлыг дэмжинэ", () => {
    expect(errMessage("тест алдаа")).toBe("тест алдаа");
  });

  it("хоосон message-тэй Error-ийг String рүү шилжүүлнэ", () => {
    // message нь хоосон бол утгагүй хоосон мөр буцаахгүй
    expect(errMessage(new Error(""))).toBe("Error");
  });

  it("null / undefined / тоог ч уначихгүйгээр боловсруулна", () => {
    expect(errMessage(null)).toBe("null");
    expect(errMessage(undefined)).toBe("undefined");
    expect(errMessage(500)).toBe("500");
  });

  it("хоосон мөртэй талбаруудыг алгасана", () => {
    expect(errMessage({ message: "", type: "", code: "REAL" })).toBe("REAL");
  });
});

describe("errCode", () => {
  it("Node/драйверын code талбарыг авна", () => {
    expect(errCode({ code: "ECONNREFUSED" })).toBe("ECONNREFUSED");
  });

  it("code байхгүй эсвэл мөр биш бол undefined", () => {
    expect(errCode({ message: "x" })).toBeUndefined();
    expect(errCode({ code: 42 })).toBeUndefined();
    expect(errCode(null)).toBeUndefined();
    expect(errCode("тэмдэгт мөр")).toBeUndefined();
  });
});

describe("errStack", () => {
  it("Error-ийн stack-ийг буцаана", () => {
    expect(errStack(new Error("x"))).toContain("Error");
  });

  it("Error биш бол undefined", () => {
    expect(errStack({ message: "x" })).toBeUndefined();
    expect(errStack("x")).toBeUndefined();
  });
});
