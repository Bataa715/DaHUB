import { describe, it, expect } from "vitest";
import {
  AI_DEFAULT_PROMPT,
  AI_MAX_NEWS,
  GOLOMT_BANK,
  buildAiMessage,
  buildAiPrompt,
  isValidIsoDate,
  newsRowKey,
  normalizeNewsRow,
  parseAiLines,
  titleCase,
} from "./negative-news.logic";

describe("titleCase", () => {
  it("Python str.strip().str.title()-тэй ижил", () => {
    expect(titleCase("  голомт банк ")).toBe(GOLOMT_BANK);
    expect(titleCase("ГОЛОМТ   БАНК")).toBe(GOLOMT_BANK);
    expect(titleCase("facebook")).toBe("Facebook");
    expect(titleCase("ikon.mn")).toBe("Ikon.Mn");
  });

  it("хоосон утга унагахгүй", () => {
    expect(titleCase(undefined)).toBe("");
  });
});

describe("normalizeNewsRow / newsRowKey", () => {
  it("ижил мэдээ өөр бичлэгтэй ирсэн ч нэг түлхүүртэй", () => {
    const a = normalizeNewsRow({
      newsDate: "2026-09-01",
      channel: "facebook",
      bank: "голомт банк",
      category: "Үйлчилгээ",
      content: "Салбарт  дараалал   их байна",
    });
    const b = normalizeNewsRow({
      newsDate: "2026-09-01 ",
      channel: " Facebook",
      bank: "ГОЛОМТ БАНК",
      category: " Үйлчилгээ ",
      content: "САЛБАРТ дараалал их байна",
    });
    expect(newsRowKey(a)).toBe(newsRowKey(b));
    expect(a.bank).toBe(GOLOMT_BANK);
  });
});

describe("isValidIsoDate", () => {
  it("бодит огноо л зөвшөөрнө", () => {
    expect(isValidIsoDate("2026-09-16")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026/09/16")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });
});

describe("buildAiPrompt", () => {
  it("даалгаваргүй бол анхдагч", () => {
    expect(buildAiPrompt("")).toBe(AI_DEFAULT_PROMPT);
    expect(buildAiPrompt("   ")).toBe(AI_DEFAULT_PROMPT);
    expect(buildAiPrompt(undefined)).toBe(AI_DEFAULT_PROMPT);
  });

  it("эх хуудасны загварт яг ижлээр оруулна (төгсгөлийн цэгийг давхардуулахгүй)", () => {
    expect(
      buildAiPrompt("хамгийн их утга давхцаж буй 5 өөр мэдээг харуулаарай."),
    ).toBe(
      "Дээрх утгуудыг мэдээ гэж нэрлэе. Дээрх мэдээнүүдээс хамгийн их утга давхцаж буй 5 өөр мэдээг харуулаарай. Ингэхдээ юуг ч битгий өөрчлөөрэй. Мөн сонгосон мэдээнүүдээс өөр зүйл нэмж хэлэх шаардлагагүй, зөвхөн сонгосон мэдээнүүдийг харуулаарай.",
    );
  });
});

describe("buildAiMessage", () => {
  it("мэдээнүүдийг хоёр мөр завсартай, төгсгөлд даалгавар", () => {
    const { message, used } = buildAiMessage(
      [" А мэдээ ", "", "Б мэдээ"],
      "Даалгавар",
    );
    expect(message).toBe("А мэдээ\n\nБ мэдээ\n\nДаалгавар");
    expect(used).toBe(2);
  });

  it("мэдээний тооны хязгаар", () => {
    const many = Array.from(
      { length: AI_MAX_NEWS + 50 },
      (_, i) => `мэдээ ${i}`,
    );
    expect(buildAiMessage(many, "x").used).toBe(AI_MAX_NEWS);
  });

  it("тэмдэгтийн хязгаар — гэхдээ эхний мэдээ заавал орно", () => {
    const huge = "а".repeat(40_000);
    expect(buildAiMessage([huge, "дараагийн"], "x").used).toBe(1);
  });
});

describe("parseAiLines", () => {
  it("хоосон мөрийг хасаж, зайг цэвэрлэнэ", () => {
    expect(parseAiLines("1. Эхний\n\n  2. Хоёр  \n")).toEqual([
      "1. Эхний",
      "2. Хоёр",
    ]);
    expect(parseAiLines(undefined)).toEqual([]);
  });
});
