import { describe, it, expect } from "vitest";
import { collectEnvIssues, validateEnv } from "./env.validation";

/**
 * Эхлэх үеийн орчны шалгалт. Энэ нь буруу тохируулсан сервер огт
 * эхлэхгүй байхыг баталгаажуулдаг тул дүрэм бүр тестлэгдсэн байх ёстой.
 */
const VALID_SECRET = "a".repeat(40);

function baseEnv(over: Record<string, string> = {}) {
  return {
    NODE_ENV: "development",
    JWT_SECRET: VALID_SECRET,
    CORS_ORIGINS: "http://localhost:9002",
    CLICKHOUSE_HOST: "http://localhost:8123",
    PORT: "3001",
    ...over,
  };
}

function prodEnv(over: Record<string, string> = {}) {
  return baseEnv({
    NODE_ENV: "production",
    CLICKHOUSE_PASSWORD: "secret",
    PYTHON_SERVICE_URL: "http://python:8001",
    PYTHON_API_KEY: "key",
    COOKIE_SECURE: "true",
    CONFIG_ENC_KEY: "b".repeat(32),
    ...over,
  });
}

describe("collectEnvIssues — бүх орчинд", () => {
  it("зөв тохиргоонд алдаа гаргахгүй", () => {
    expect(collectEnvIssues(baseEnv()).errors).toEqual([]);
  });

  it("JWT_SECRET дутуу бол алдаа", () => {
    const { errors } = collectEnvIssues(baseEnv({ JWT_SECRET: "" }));
    expect(errors.some((e) => e.includes("JWT_SECRET"))).toBe(true);
  });

  it("JWT_SECRET 32 тэмдэгтээс богино бол алдаа", () => {
    const { errors } = collectEnvIssues(baseEnv({ JWT_SECRET: "short" }));
    expect(errors.some((e) => e.includes("32"))).toBe(true);
  });

  it("үндсэн (default) JWT_SECRET-ийг татгалзана", () => {
    const { errors } = collectEnvIssues(
      baseEnv({ JWT_SECRET: "your-secret-key-change-in-production" }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it("CORS_ORIGINS дутуу бол алдаа", () => {
    const { errors } = collectEnvIssues(baseEnv({ CORS_ORIGINS: "" }));
    expect(errors.some((e) => e.includes("CORS_ORIGINS"))).toBe(true);
  });

  it("CLICKHOUSE_HOST дутуу бол алдаа", () => {
    const { errors } = collectEnvIssues(baseEnv({ CLICKHOUSE_HOST: "" }));
    expect(errors.some((e) => e.includes("CLICKHOUSE_HOST"))).toBe(true);
  });

  it("PORT буруу бол алдаа", () => {
    expect(collectEnvIssues(baseEnv({ PORT: "0" })).errors.length).toBe(1);
    expect(collectEnvIssues(baseEnv({ PORT: "99999" })).errors.length).toBe(1);
    expect(collectEnvIssues(baseEnv({ PORT: "abc" })).errors.length).toBe(1);
  });

  it("PORT заагаагүй бол 3001 гэж үзнэ", () => {
    const env = baseEnv();
    delete (env as Record<string, string>).PORT;
    expect(collectEnvIssues(env).errors).toEqual([]);
  });
});

describe("collectEnvIssues — зөвхөн production", () => {
  it("бүрэн prod тохиргоо алдаагүй", () => {
    expect(collectEnvIssues(prodEnv()).errors).toEqual([]);
  });

  it("CLICKHOUSE_PASSWORD дутуу бол алдаа", () => {
    const { errors } = collectEnvIssues(prodEnv({ CLICKHOUSE_PASSWORD: "" }));
    expect(errors.some((e) => e.includes("CLICKHOUSE_PASSWORD"))).toBe(true);
  });

  it("PYTHON_API_URL нь PYTHON_SERVICE_URL-ийг орлож чадна", () => {
    const env = prodEnv({ PYTHON_API_URL: "http://python:8001" });
    delete (env as Record<string, string>).PYTHON_SERVICE_URL;
    expect(collectEnvIssues(env).errors).toEqual([]);
  });

  it("Python URL хоёулаа дутуу бол алдаа", () => {
    const env = prodEnv();
    delete (env as Record<string, string>).PYTHON_SERVICE_URL;
    const { errors } = collectEnvIssues(env);
    expect(errors.some((e) => e.includes("PYTHON_SERVICE_URL"))).toBe(true);
  });

  it("PYTHON_API_KEY дутуу бол алдаа (сервис рүү код илгээдэг)", () => {
    const { errors } = collectEnvIssues(prodEnv({ PYTHON_API_KEY: "" }));
    expect(errors.some((e) => e.includes("PYTHON_API_KEY"))).toBe(true);
  });

  it("COOKIE_SECURE дутуу бол алдаа", () => {
    const { errors } = collectEnvIssues(prodEnv({ COOKIE_SECURE: "" }));
    expect(errors.some((e) => e.includes("COOKIE_SECURE"))).toBe(true);
  });

  it("COOKIE_SECURE=false бол алдаа биш, САНУУЛГА", () => {
    const { errors, warnings } = collectEnvIssues(
      prodEnv({ COOKIE_SECURE: "false" }),
    );
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes("COOKIE_SECURE"))).toBe(true);
  });

  it("localhost руу заасан бол сануулга өгнө (deploy алдаа)", () => {
    const { errors, warnings } = collectEnvIssues(
      prodEnv({ CLICKHOUSE_HOST: "http://localhost:8123" }),
    );
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes("CLICKHOUSE_HOST"))).toBe(true);
  });

  it("CONFIG_ENC_KEY дутуу бол сануулга (JWT_SECRET рүү ухарна)", () => {
    const env = prodEnv();
    delete (env as Record<string, string>).CONFIG_ENC_KEY;
    const { errors, warnings } = collectEnvIssues(env);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes("CONFIG_ENC_KEY"))).toBe(true);
  });

  it("CREDENTIAL_ENCRYPTION_KEY нь CONFIG_ENC_KEY-г орлоно", () => {
    const env = prodEnv({ CREDENTIAL_ENCRYPTION_KEY: "c".repeat(32) });
    delete (env as Record<string, string>).CONFIG_ENC_KEY;
    const { warnings } = collectEnvIssues(env);
    expect(warnings.some((w) => w.includes("CONFIG_ENC_KEY"))).toBe(false);
  });

  it("development дээр prod-ын шаардлагууд хэрэглэгдэхгүй", () => {
    // CLICKHOUSE_PASSWORD, PYTHON_*, COOKIE_SECURE байхгүй ч алдаагүй
    expect(collectEnvIssues(baseEnv()).errors).toEqual([]);
  });
});

describe("validateEnv", () => {
  it("зөв тохиргоонд config-ийг хэвээр буцаана (ConfigModule-ийн гэрээ)", () => {
    const env = baseEnv();
    expect(validateEnv(env)).toBe(env);
  });

  it("алдаатай бол шидэж, бүх алдааг нэг мессежид жагсаана", () => {
    expect(() =>
      validateEnv(baseEnv({ JWT_SECRET: "", CORS_ORIGINS: "" })),
    ).toThrow(/JWT_SECRET[\s\S]*CORS_ORIGINS|CORS_ORIGINS[\s\S]*JWT_SECRET/);
  });

  it("идемпотент — хоёр удаа дуудахад ижил үр дүн", () => {
    const env = baseEnv();
    expect(validateEnv(env)).toBe(env);
    expect(validateEnv(env)).toBe(env);
  });
});
