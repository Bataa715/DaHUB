import { describe, it, expect } from "vitest";
import {
  GOLOMT_BANK,
  clusterSimilarNews,
  isValidIsoDate,
  jaccard,
  newsRowKey,
  normalizeNewsRow,
  titleCase,
  tokenize,
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

describe("tokenize / jaccard", () => {
  it("цэг таслал, богино болон түгээмэл үгийг хасна", () => {
    expect([...tokenize("Банк нь ба ЗЭЭЛ, зээл!")]).toEqual(["банк", "зээл"]);
  });

  it("jaccard", () => {
    expect(jaccard(new Set(["а1а", "б2б"]), new Set(["а1а", "б2б"]))).toBe(1);
    expect(jaccard(new Set(["ааа"]), new Set(["ббб"]))).toBe(0);
    expect(jaccard(new Set(), new Set(["ааа"]))).toBe(0);
  });
});

describe("clusterSimilarNews", () => {
  const n = (id: number, content: string) => ({ id, content });

  it("ойролцоо мэдээг нэг бүлэгт, хэмжээгээр буурахаар", () => {
    const items = [
      n(1, "Картын гүйлгээ амжилтгүй болж харилцагчид гомдол гаргалаа"),
      n(2, "Харилцагчид картын гүйлгээ амжилтгүй болсон гэж гомдол гаргалаа"),
      n(
        3,
        "Картын гүйлгээ дахин амжилтгүй болж харилцагчид гомдоллов гаргалаа",
      ),
      n(4, "Салбарын дараалал хэт урт байна үйлчилгээ удаан"),
      n(5, "Салбарын дараалал урт, үйлчилгээ удаан байна"),
      n(6, "Шинэ аппликейшн гарлаа"),
    ];
    const clusters = clusterSimilarNews(items);
    expect(clusters.map((c) => c.size)).toEqual([3, 2]);
    expect(clusters[0].members.map((m) => m.id).sort()).toEqual([1, 2, 3]);
    expect(clusters[1].members.map((m) => m.id).sort()).toEqual([4, 5]);
  });

  it("давхцалгүй бол бүлэг үүсэхгүй", () => {
    expect(clusterSimilarNews([n(1, "ааа ббб"), n(2, "ввв ггг")])).toEqual([]);
  });

  it("limit-ээр хязгаарлана", () => {
    const items = Array.from({ length: 8 }, (_, i) => [
      n(i * 10, `сэдэв${i} мэдээ давтагдсан агуулга`),
      n(i * 10 + 1, `сэдэв${i} мэдээ давтагдсан агуулга`),
    ]).flat();
    expect(
      clusterSimilarNews(items, { threshold: 0.9, limit: 3 }),
    ).toHaveLength(3);
  });
});
