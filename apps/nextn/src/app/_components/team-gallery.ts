/**
 * Нүүр хуудсын хамт олны landscape галерей — `public/team` (лого шиг статик).
 */
export type TeamGallerySlide = {
  id: string;
  src: string;
  alt: string;
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|svg)$/i;

function slideFromFile(filename: string): TeamGallerySlide {
  const id = filename.replace(/^.*[/\\]/, "");
  return {
    id,
    src: `/team/${encodeURIComponent(id)}`,
    alt: id.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
  };
}

const FALLBACK_FILES = ["Team1.png", "Team2.png"];

/** Лого шиг `public/team` — API биш. */
export async function loadTeamGallery(): Promise<TeamGallerySlide[]> {
  try {
    const res = await fetch(`/team/manifest.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { files?: unknown };
      const files = Array.isArray(data.files)
        ? data.files.filter(
            (f): f is string => typeof f === "string" && IMAGE_EXT.test(f),
          )
        : [];
      if (files.length > 0) return files.map(slideFromFile);
    }
  } catch {
    /* fallback */
  }
  return FALLBACK_FILES.map(slideFromFile);
}
