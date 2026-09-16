import { teamGalleryApi, type TeamGallerySlide } from "@/lib/api";

/**
 * Нүүр хуудсын хамт олны зураг — лого шиг `public/team`.
 */
export type { TeamGallerySlide };

export const DEFAULT_TEAM_SLIDES: TeamGallerySlide[] = [
  { id: "Team1.jpg", src: "/team/Team1.jpg", alt: "Team 1" },
  { id: "Team2.jpg", src: "/team/Team2.jpg", alt: "Team 2" },
];

/** Админ нэмсэн зураг байвал `/team-gallery`-аас авна, үгүй бол public/team. */
export async function loadTeamGallery(): Promise<TeamGallerySlide[]> {
  try {
    const slides = await teamGalleryApi.list();
    if (slides.length > 0) return slides;
  } catch {
    /* public/team fallback */
  }
  return DEFAULT_TEAM_SLIDES;
}
