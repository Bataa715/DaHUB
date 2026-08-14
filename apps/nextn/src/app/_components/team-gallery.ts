/**
 * Нүүр хуудсын хамт олны зураг — лого шиг `public/team/*.png`.
 * JSON/API жагсаалт ашиглахгүй (prod дээр /team/manifest 404 гардаг).
 */
export type TeamGallerySlide = {
  id: string;
  src: string;
  alt: string;
};

export const DEFAULT_TEAM_SLIDES: TeamGallerySlide[] = [
  { id: "Team1.png", src: "/team/Team1.png", alt: "Team 1" },
  { id: "Team2.png", src: "/team/Team2.png", alt: "Team 2" },
];

/** Админ нэмсэн зураг байвал `/team-gallery`-аас авна, үгүй бол public/team. */
export async function loadTeamGallery(): Promise<TeamGallerySlide[]> {
  try {
    const res = await fetch("/team-gallery", {
      cache: "no-store",
      credentials: "include",
    });
    if (res.ok) {
      const data = (await res.json()) as { slides?: TeamGallerySlide[] };
      if (Array.isArray(data.slides) && data.slides.length > 0) {
        return data.slides;
      }
    }
  } catch {
    /* public/team fallback */
  }
  return DEFAULT_TEAM_SLIDES;
}
