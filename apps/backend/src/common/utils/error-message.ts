/**
 * `unknown` төрлийн алдаанаас уншигдахуйц мессеж гаргаж авна.
 *
 * [AUDIT] Өмнө нь `catch (e: any)` гэж бичээд `e.message` рүү шууд ханддаг
 * байсан нь TypeScript-ийн шалгалтыг тойрч, алдааны объект өөр хэлбэртэй
 * ирвэл ажиллах үед `undefined` болдог байв. Одоо catch хувьсагч `unknown`
 * хэвээр үлдэж, мессежийг ЭНД төрөл-аюулгүйгээр задална.
 *
 * ClickHouse/Oracle драйверууд `message` биш `type` талбартай алдаа
 * буцаадаг тохиолдол байдаг тул түүнийг ч харгалзана.
 */
export function errMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;

  if (typeof e === "object" && e !== null) {
    const o = e as { message?: unknown; type?: unknown; code?: unknown };
    if (typeof o.message === "string" && o.message) return o.message;
    if (typeof o.type === "string" && o.type) return o.type;
    if (typeof o.code === "string" && o.code) return o.code;
  }

  if (typeof e === "string") return e;
  return String(e);
}

/** Алдааны stack (байвал) — логт бичихэд ашиглана. */
export function errStack(e: unknown): string | undefined {
  return e instanceof Error ? e.stack : undefined;
}

/** Алдааны `code` талбар (Node/драйверын алдаанд түгээмэл). */
export function errCode(e: unknown): string | undefined {
  if (typeof e === "object" && e !== null) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}
