/**
 * Нүүр хуудсын хамт олны зураг — лого шиг `public/team`.
 */
export type TeamGallerySlide = {
  id: string;
  src: string;
  alt: string;
};

export const DEFAULT_TEAM_SLIDES: TeamGallerySlide[] = [
  { id: "Team1.jpg", src: "/team/Team1.jpg", alt: "Team 1" },
  { id: "Team2.jpg", src: "/team/Team2.jpg", alt: "Team 2" },
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
