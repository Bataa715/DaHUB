import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "path";

/**
 * Өгөгдлийн толь бичгийн файлын зам сонголт.
 *
 * [AUDIT] Энэ логик production дээр эвдэрсэн байсан: `Data/` хавтас
 * standalone build-д ордоггүй тул файл олдохгүй, tool хоосон жагсаалт
 * харуулдаг байв. Одоо `outputFileTracingIncludes`-ээр савлагддаг болсон ба
 * доорх тестүүд зам сонголтын дараалал эвдрэхээс хамгаална.
 */

const existing = new Set<string>();
const copied: { from: string; to: string }[] = [];

vi.mock("fs", () => ({
  default: {
    existsSync: (p: string) => existing.has(path.resolve(p)),
    mkdirSync: vi.fn(),
    copyFileSync: (from: string, to: string) => {
      copied.push({ from, to });
      existing.add(path.resolve(to));
    },
    readFileSync: () => "",
  },
}));

const MD = "Database_Dictionary.md";

async function loadGetMdPath() {
  vi.resetModules();
  const mod = await import("./schema-parser");
  return mod.getMdPath;
}

let cwdSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  existing.clear();
  copied.length = 0;
  delete process.env.MD_FILE_PATH;
  // Standalone build-ийн бодит бүтэц: server нь .../standalone/apps/nextn-ээс
  // ажилладаг, Data/ нь .../standalone/Data дээр буудаг.
  cwdSpy = vi
    .spyOn(process, "cwd")
    .mockReturnValue(path.resolve("/app/.next/standalone/apps/nextn"));
});

afterEach(() => {
  cwdSpy.mockRestore();
});

describe("getMdPath — савлагдсан файлыг олох", () => {
  it("cwd/Data дотор байвал түүнийг сонгоно", async () => {
    const p = path.resolve("/app/.next/standalone/apps/nextn/Data", MD);
    existing.add(p);
    const getMdPath = await loadGetMdPath();
    expect(getMdPath()).toBe(p);
  });

  it("хоёр түвшин дээш (standalone/Data) байвал олно", async () => {
    // Энэ бол `outputFileTracingIncludes`-ээр савлагдсаны дараах БОДИТ байрлал
    const p = path.resolve("/app/.next/standalone/Data", MD);
    existing.add(p);
    const getMdPath = await loadGetMdPath();
    expect(getMdPath()).toBe(p);
  });

  it("Docker-ийн /app/Data байрлалыг олно", async () => {
    const p = path.resolve("/app/Data", MD);
    existing.add(p);
    const getMdPath = await loadGetMdPath();
    expect(getMdPath()).toBe(p);
  });

  it("хаана ч байхгүй бол cwd/Data руу чиглүүлнэ (уначихгүй)", async () => {
    const getMdPath = await loadGetMdPath();
    expect(getMdPath()).toBe(
      path.resolve("/app/.next/standalone/apps/nextn/Data", MD),
    );
  });
});

describe("getMdPath — MD_FILE_PATH (байнгын хадгалалт)", () => {
  it("заасан зам байвал ТҮҮНИЙГ эрхэмлэнэ", async () => {
    const persistent = path.resolve("/var/lib/dahub", MD);
    const bundled = path.resolve("/app/.next/standalone/Data", MD);
    existing.add(persistent);
    existing.add(bundled);
    process.env.MD_FILE_PATH = persistent;

    const getMdPath = await loadGetMdPath();
    expect(getMdPath()).toBe(persistent);
  });

  it("заасан зам ХООСОН бол савлагдсанаас нэг удаа хуулж эхлүүлнэ", async () => {
    const persistent = path.resolve("/var/lib/dahub", MD);
    const bundled = path.resolve("/app/.next/standalone/Data", MD);
    existing.add(bundled);
    process.env.MD_FILE_PATH = persistent;

    const getMdPath = await loadGetMdPath();
    expect(getMdPath()).toBe(persistent);
    expect(copied).toHaveLength(1);
    expect(copied[0].from).toBe(bundled);
    expect(copied[0].to).toBe(persistent);
  });

  it("харьцангуй замыг cwd-ээс тооцно", async () => {
    process.env.MD_FILE_PATH = "data/dict.md";
    const abs = path.resolve("/app/.next/standalone/apps/nextn", "data/dict.md");
    existing.add(abs);

    const getMdPath = await loadGetMdPath();
    expect(getMdPath()).toBe(abs);
  });

  it("заасан зам ч, савлагдсан ч байхгүй бол заасныг буцаана", async () => {
    const persistent = path.resolve("/var/lib/dahub", MD);
    process.env.MD_FILE_PATH = persistent;

    const getMdPath = await loadGetMdPath();
    expect(getMdPath()).toBe(persistent);
    expect(copied).toHaveLength(0);
  });

  it("зөвхөн зайнаас бүрдсэн MD_FILE_PATH-ыг үл тоомсорлоно", async () => {
    const bundled = path.resolve("/app/.next/standalone/Data", MD);
    existing.add(bundled);
    process.env.MD_FILE_PATH = "   ";

    const getMdPath = await loadGetMdPath();
    expect(getMdPath()).toBe(bundled);
  });
});
