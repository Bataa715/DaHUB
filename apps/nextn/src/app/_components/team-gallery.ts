/**
 * Нүүр хуудасны хамт олны landscape галерей.
 * Зургуудыг `apps/nextn/public/team/` дотор тавьж, энд жагсаалтад нэмнэ.
 * Дараа нь admin upload API холбоход энэ manifest-ийг солиход хангалттай.
 */
export type TeamGallerySlide = {
  id: string;
  src: string;
  alt: string;
};

export const TEAM_GALLERY_SLIDES: TeamGallerySlide[] = [
  {
    id: "team-1",
    src: "/team/team-1.svg",
    alt: "Дотоод аудитын хамт олон",
  },
  {
    id: "team-2",
    src: "/team/team-2.svg",
    alt: "Хамт олны ажлын мөч",
  },
  {
    id: "team-3",
    src: "/team/team-3.svg",
    alt: "Багийн уулзалт",
  },
];
