/**
 * Орчны хувьсагчийн ЦОР ГАНЦ баталгаажуулалт.
 *
 * Хоёр газраас дуудагдана:
 *   1. `main.ts` — NestFactory.create()-аас ӨМНӨ, ямар нэг холболт
 *      үүсгэхээс нааш буруу тохиргоог барихын тулд.
 *   2. `app.module.ts`-ийн `ConfigModule.validate` — модуль ачаалагдах үед
 *      (өмнө нь `return config` гэсэн хоосон stub байсан).
 *
 * Функц нь ЦЭВЭР (pure) бөгөөд идемпотент — хоёр удаа дуудагдахад асуудалгүй.
 */

export interface EnvIssues {
  errors: string[];
  warnings: string[];
}

const DEFAULT_JWT_SECRETS = new Set([
  "your-secret-key-change-in-production",
  "changeme",
  "secret",
]);

/** production дээр localhost руу заасан байвал deploy алдаа гэж сэжиглэнэ */
const LOCALISH = /(localhost|127\.0\.0\.1)/i;

export function collectEnvIssues(
  env: Record<string, unknown> = process.env,
): EnvIssues {
  const errors: string[] = [];
  const warnings: string[] = [];
  const str = (k: string): string =>
    typeof env[k] === "string" ? (env[k] as string).trim() : "";

  const isProd = str("NODE_ENV") === "production";

  // ── Бүх орчинд заавал байх ────────────────────────────────────────────────
  const jwtSecret = str("JWT_SECRET");
  if (!jwtSecret) {
    errors.push("JWT_SECRET шаардлагатай");
  } else if (jwtSecret.length < 32) {
    errors.push("JWT_SECRET дор хаяж 32 тэмдэгт байх ёстой");
  } else if (DEFAULT_JWT_SECRETS.has(jwtSecret)) {
    errors.push("JWT_SECRET-ийг үндсэн (default) утгаас өөрчлөх ёстой");
  }

  if (!str("CORS_ORIGINS")) {
    errors.push("CORS_ORIGINS шаардлагатай");
  }

  if (!str("CLICKHOUSE_HOST")) {
    errors.push("CLICKHOUSE_HOST шаардлагатай");
  }

  const rawPort = str("PORT") || "3001";
  const port = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push(`PORT 1-65535 хооронд байх ёстой (одоо: "${rawPort}")`);
  }

  // ── Зөвхөн production дээр заавал байх ────────────────────────────────────
  if (isProd) {
    if (!str("CLICKHOUSE_PASSWORD")) {
      errors.push("production дээр CLICKHOUSE_PASSWORD шаардлагатай");
    }
    // Python сервис рүү код илгээдэг тул түлхүүргүй ажиллахыг хориглоно
    if (!str("PYTHON_SERVICE_URL") && !str("PYTHON_API_URL")) {
      errors.push(
        "production дээр PYTHON_SERVICE_URL (эсвэл PYTHON_API_URL) шаардлагатай",
      );
    }
    if (!str("PYTHON_API_KEY")) {
      errors.push("production дээр PYTHON_API_KEY шаардлагатай");
    }
    // cookie-ийн secure горимыг ил тод сонгосон байх ёстой
    if (!str("COOKIE_SECURE")) {
      errors.push("production дээр COOKIE_SECURE шаардлагатай");
    } else if (str("COOKIE_SECURE") !== "true") {
      warnings.push(
        "COOKIE_SECURE нь 'true' биш — auth cookie энгийн HTTP-ээр явна",
      );
    }

    for (const key of [
      "PYTHON_SERVICE_URL",
      "PYTHON_API_URL",
      "CLICKHOUSE_HOST",
      "CORS_ORIGINS",
    ]) {
      const v = str(key);
      if (v && LOCALISH.test(v)) {
        warnings.push(
          `${key} production дээр localhost руу заасан байна: ${v}`,
        );
      }
    }

    // [C-3] DB credential-ийг JWT_SECRET-ээс салгах тусдаа түлхүүр
    if (!str("CONFIG_ENC_KEY") && !str("CREDENTIAL_ENCRYPTION_KEY")) {
      warnings.push(
        "CONFIG_ENC_KEY тохируулаагүй — DB тохиргооны нууцлал JWT_SECRET-ээс гаралтай түлхүүр ашиглана",
      );
    }
  }

  return { errors, warnings };
}

/**
 * ConfigModule.validate болон main.ts-д ашиглана.
 * Алдаа байвал шидэж, сануулгыг stderr рүү бичнэ. Амжилттай бол `config`-ийг
 * хэвээр буцаана (ConfigModule ийм гэрээтэй).
 */
export function validateEnv<T extends Record<string, unknown>>(config: T): T {
  const { errors, warnings } = collectEnvIssues(config);

  for (const w of warnings) {
    // eslint-disable-next-line no-console
    console.warn(`[env] WARNING: ${w}`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Орчны хувьсагчийн алдаа — сервер эхлэхгүй:\n  - ${errors.join("\n  - ")}`,
    );
  }
  return config;
}
