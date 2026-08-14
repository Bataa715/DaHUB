import path from "path";
import fs from "fs/promises";

export type TeamGallerySlide = {
  id: string;
  src: string;
  alt: string;
};

const ALLOWED_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
]);

export const TEAM_PUBLIC_DIR = path.join(process.cwd(), "public", "team");

export function teamDir(): string {
  return TEAM_PUBLIC_DIR;
}

export function isAllowedImageName(filename: string): boolean {
  const base = path.basename(filename);
  if (base !== filename || base.includes("..") || base.startsWith(".")) {
    return false;
  }
  return ALLOWED_EXT.has(path.extname(base).toLowerCase());
}

export function safeTeamFilename(original: string): string {
  const ext = path.extname(original).toLowerCase();
  const stem = path
    .basename(original, path.extname(original))
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const name = stem || "team";
  return `${name}${ext}`;
}

export async function listTeamImages(): Promise<TeamGallerySlide[]> {
  await fs.mkdir(TEAM_PUBLIC_DIR, { recursive: true });
  const files = await fs.readdir(TEAM_PUBLIC_DIR);
  const withStat = await Promise.all(
    files
      .filter((f) => isAllowedImageName(f))
      .map(async (f) => {
        const st = await fs.stat(path.join(TEAM_PUBLIC_DIR, f));
        return { f, mtime: st.mtimeMs };
      }),
  );
  withStat.sort((a, b) => a.f.localeCompare(b.f, undefined, { numeric: true }));
  const slides = withStat.map(({ f }) => ({
    id: f,
    src: `/team/${encodeURIComponent(f)}`,
    alt: path.basename(f, path.extname(f)).replace(/[-_]+/g, " "),
  }));
  return slides;
}

export async function uniqueTeamPath(filename: string): Promise<string> {
  let candidate = filename;
  let i = 2;
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext);
  while (true) {
    try {
      await fs.access(path.join(TEAM_PUBLIC_DIR, candidate));
      candidate = `${stem}-${i}${ext}`;
      i += 1;
    } catch {
      return candidate;
    }
  }
}
