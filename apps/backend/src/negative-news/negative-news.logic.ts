/**
 * Сөрөг мэдээ — цэвэр функцүүд (DB-гүй, тестлэгдэнэ).
 *
 * Эх сурвалж: өмнөх "Сөрөг мэдээний анализ" систем (Projects/sorog medee) —
 * `app_v2.py`, `prototype_v11_image_fix.py`, `templates/uploud.html`.
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

// ─── AI шинжилгээ (Together) ───────────────────────────────────────────────

/** Даалгавар өгөөгүй үеийн анхдагч (эх скриптийн `static/text.txt` байхгүй үеийнх) */
export const AI_DEFAULT_PROMPT =
  "Дээрх мэдээнүүдээс хоорондоо хамгийн ойролцоо утгатай 5 мэдээг ялгаж өгөөч.";

/** Эх хуудасны "Санал болгох аргууд" товчнууд */
export const AI_SUGGESTED_INSTRUCTIONS = [
  "хоорондоо хамгийн ойролцоо утгатай буюу ерөнхий утга давхардсан 5 мэдээг ялгаж өгөөч",
  "хамгийн их утга давхцаж буй 5 өөр мэдээг харуулаарай",
] as const;

/** Нэг хүсэлтэд илгээх дээд хэмжээ — зардал, контекстийн хязгаараас хамгаална */
export const AI_MAX_NEWS = 200;
export const AI_MAX_CHARS = 30_000;

/**
 * Хэрэглэгчийн даалгаврыг эх хуудасны (`uploud.html`) загварт яг ижлээр оруулна.
 * Хоосон бол анхдагч даалгавар.
 */
export function buildAiPrompt(instruction?: string | null): string {
  const text = (instruction ?? "").trim().replace(/[.\s]+$/, "");
  if (!text) return AI_DEFAULT_PROMPT;
  return `Дээрх утгуудыг мэдээ гэж нэрлэе. Дээрх мэдээнүүдээс ${text}. Ингэхдээ юуг ч битгий өөрчлөөрэй. Мөн сонгосон мэдээнүүдээс өөр зүйл нэмж хэлэх шаардлагагүй, зөвхөн сонгосон мэдээнүүдийг харуулаарай.`;
}

/**
 * Эх скрипттэй адил: мэдээнүүдийг хоёр мөр завсартай нийлүүлээд, төгсгөлд нь
 * даалгавар. Хязгаар хэтэрвэл үлдсэн мэдээг орхино (`used` — орсон тоо).
 */
export function buildAiMessage(
  contents: string[],
  prompt: string,
): { message: string; used: number } {
  const picked: string[] = [];
  let chars = 0;
  for (const raw of contents) {
    const content = raw.trim();
    if (!content) continue;
    if (picked.length >= AI_MAX_NEWS) break;
    if (picked.length > 0 && chars + content.length > AI_MAX_CHARS) break;
    picked.push(content);
    chars += content.length + 2;
  }
  return {
    message: `${picked.join("\n\n")}\n\n${prompt}`,
    used: picked.length,
  };
}

/** AI-ийн хариуг мөр мөрөөр — хоосон мөрийг хасна (эх скриптийн хүснэгттэй адил). */
export function parseAiLines(text: string | null | undefined): string[] {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
