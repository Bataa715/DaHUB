/**
 * Сөрөг мэдээ — цэвэр функцүүд (DB-гүй, тестлэгдэнэ).
 *
 * Эх сурвалж: өмнөх "Сөрөг мэдээний анализ" скрипт. Тэнд Голомт банкны мэдээний
 * агуулгыг гадны AI үйлчилгээ рүү илгээж "ойролцоо утгатай мэдээ"-г сонгуулдаг
 * байсан. [SEC] Банкны мэдээлэл гадагш гарах тул тэр аргыг ХЭРЭГЛЭХГҮЙ — оронд нь
 * үгийн давхцлаар (Jaccard) дотооддоо бүлэглэнэ: ижил оролт → үргэлж ижил үр дүн.
 */

/** Голомт банкны нэр — `titleCase`-ээр нормчилсны дараах хэлбэр */
export const GOLOMT_BANK = "Голомт Банк";

/**
 * Python-ы `str.strip().str.title()`-тэй ижил: үг бүрийн эхний үсэг том, бусад нь жижиг.
 * "голомт банк" / "ГОЛОМТ БАНК" → "Голомт Банк" — тоолохдоо нэг утга болно.
 */
export function titleCase(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(
      /(^|[^\p{L}])(\p{L})/gu,
      (_m, sep: string, ch: string) => sep + ch.toUpperCase(),
    );
}

export interface NewsRowInput {
  newsDate: string;
  channel: string;
  bank: string;
  category: string;
  content: string;
}

/** Хадгалахаас өмнө нэг хэлбэрт оруулна — давхардал шалгах түлхүүр ч мөн эндээс. */
export function normalizeNewsRow(row: NewsRowInput): NewsRowInput {
  return {
    newsDate: row.newsDate.trim(),
    channel: titleCase(row.channel),
    bank: titleCase(row.bank),
    category: (row.category ?? "").trim().replace(/\s+/g, " "),
    content: (row.content ?? "").trim().replace(/\s+/g, " "),
  };
}

/** Давхардал танихад хэрэглэх мөр — hash-ийг service тооцно. */
export function newsRowKey(row: NewsRowInput): string {
  return [
    row.newsDate,
    row.bank,
    row.channel,
    row.category,
    row.content.toLowerCase(),
  ].join("|");
}

/** YYYY-MM-DD бөгөөд бодит огноо эсэх (2026-02-30 биш) */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// ─── Ижил утгатай мэдээ бүлэглэх ───────────────────────────────────────────

/** Утга илэрхийлэхгүй түгээмэл үгс — давхцал тооцохдоо хасна */
const STOPWORDS = new Set([
  "ба",
  "болон",
  "нь",
  "энэ",
  "тэр",
  "гэж",
  "юм",
  "байна",
  "байгаа",
  "бол",
  "хийх",
  "дээр",
  "мөн",
  "их",
  "бүр",
  "гэсэн",
  "шиг",
  "бөгөөд",
  "байсан",
  "гэх",
  "одоо",
  "талаар",
  "тухай",
  "хүртэл",
  "зэрэг",
  "бусад",
  "гэдэг",
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
]);

export function tokenize(content: string): Set<string> {
  const words = (content ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return new Set(words);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const w of small) if (large.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface SimilarNewsCluster<T> {
  /** Бүлгийг төлөөлөх мэдээ — бусадтайгаа хамгийн олон холбоотой нь */
  representative: T;
  size: number;
  members: T[];
}

/**
 * Ойролцоо утгатай мэдээг бүлэглэнэ (union-find). Зөвхөн 2+ мэдээтэй бүлэг,
 * хэмжээгээр буурахаар. O(n²) тул дуудагч тал `n`-ийг хязгаарлана.
 */
export function clusterSimilarNews<T extends { content: string }>(
  items: T[],
  opts: { threshold?: number; limit?: number } = {},
): SimilarNewsCluster<T>[] {
  const threshold = opts.threshold ?? 0.35;
  const limit = opts.limit ?? 5;
  const tokens = items.map((i) => tokenize(i.content));
  const parent = items.map((_, i) => i);
  const links = items.map(() => 0);

  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (jaccard(tokens[i], tokens[j]) >= threshold) {
        links[i]++;
        links[j]++;
        const ri = find(i);
        const rj = find(j);
        if (ri !== rj) parent[rj] = ri;
      }
    }
  }

  const groups = new Map<number, number[]>();
  items.forEach((_, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), i]);
  });

  return [...groups.values()]
    .filter((idx) => idx.length >= 2)
    .map((idx) => {
      const rep = idx.reduce(
        (best, i) => (links[i] > links[best] ? i : best),
        idx[0],
      );
      return {
        representative: items[rep],
        size: idx.length,
        members: idx.map((i) => items[i]),
      };
    })
    .sort((a, b) => b.size - a.size)
    .slice(0, limit);
}
