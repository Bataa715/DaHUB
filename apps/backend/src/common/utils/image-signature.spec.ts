import { describe, it, expect } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { sniffImageMime, assertRealImage } from "./image-signature";

/** Тухайн гарын үсгээр эхэлж, дараа нь хогоор дүүргэсэн буфер үүсгэнэ. */
function withHeader(bytes: number[]): Buffer {
  return Buffer.concat([Buffer.from(bytes), Buffer.alloc(16, 0x41)]);
}

const JPEG = withHeader([0xff, 0xd8, 0xff, 0xe0]);
const PNG = withHeader([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF = withHeader([...Buffer.from("GIF89a", "latin1")]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF", "latin1"),
  Buffer.from([0x00, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP", "latin1"),
  Buffer.alloc(8, 0x41),
]);

describe("sniffImageMime", () => {
  it("бодит зургийн төрлийг байтаас нь таньна", () => {
    expect(sniffImageMime(JPEG)).toBe("image/jpeg");
    expect(sniffImageMime(PNG)).toBe("image/png");
    expect(sniffImageMime(GIF)).toBe("image/gif");
    expect(sniffImageMime(WEBP)).toBe("image/webp");
  });

  it("зураг биш агуулгад null буцаана", () => {
    expect(sniffImageMime(Buffer.from("<?php system($_GET[0]); ?>"))).toBeNull();
    expect(sniffImageMime(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    // MZ — Windows гүйцэтгэх файл
    expect(sniffImageMime(withHeader([0x4d, 0x5a]))).toBeNull();
  });

  it("хэт богино буферийг татгалзана", () => {
    expect(sniffImageMime(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
    expect(sniffImageMime(Buffer.alloc(0))).toBeNull();
  });
});

describe("assertRealImage", () => {
  it("зарласан төрөл нь агуулгатайгаа таарвал нэвтрүүлнэ", () => {
    expect(assertRealImage(PNG, "image/png")).toBe("image/png");
    expect(assertRealImage(JPEG, "image/jpeg")).toBe("image/jpeg");
  });

  it("image/jpg-г image/jpeg-тэй ижилд тооцно", () => {
    expect(assertRealImage(JPEG, "image/jpg")).toBe("image/jpeg");
  });

  it("зураг мэт дүр эсгэсэн агуулгыг татгалзана", () => {
    // Гол хамгаалалт: халдагч дурын агуулгыг "image/png" гэж зарлаж болно.
    expect(() =>
      assertRealImage(Buffer.from("<?php system($_GET[0]); ?>"), "image/png"),
    ).toThrow(BadRequestException);
  });

  it("жинхэнэ зураг ч зарласан төрөлтэйгээ зөрвөл татгалзана", () => {
    expect(() => assertRealImage(PNG, "image/gif")).toThrow(BadRequestException);
  });

  it("зарласан төрөлгүй үед зөвхөн зураг мөн эсэхийг шалгана", () => {
    expect(assertRealImage(GIF)).toBe("image/gif");
    expect(() => assertRealImage(Buffer.from("not an image at all"))).toThrow(
      BadRequestException,
    );
  });
});
