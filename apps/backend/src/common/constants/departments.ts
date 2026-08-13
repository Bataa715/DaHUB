/**
 * Department codes used to generate user IDs.
 * Single source of truth — shared by auth.service.ts and users.service.ts.
 * Keep in sync with apps/nextn/src/lib/constants.ts
 *
 * UserId: ихэнхэд `DAG-{CODE}-Name` (ж: DAG-DAA-Bat).
 * Чанарын баталгаажуулалтын алба (CHBA) л DAG prefixгүй.
 */
export const DEPARTMENT_CODES: Record<string, string> = {
  Удирдлага: "DAG",
  "Дата анализын алба": "DAA",
  "Бизнесийн аудитын хэлтэс": "BAH",
  "Эрсдэл, комплаенс, санхүүгийн аудитын хэлтэс": "EKSAH",
  "Мэдээллийн технологийн аудитын хэлтэс": "MTAH",
  "Чанарын баталгаажуулалтын алба": "CHBA",
};

/** DAG prefix авахгүй хэлтэс/алба */
export const NO_DAG_PREFIX_DEPARTMENTS = new Set([
  "Чанарын баталгаажуулалтын алба",
]);

/** Захирал албан тушаал / `.Name-…` director userId байхгүй алба */
export const NO_DIRECTOR_DEPARTMENTS = new Set([
  "Дата анализын алба",
  "Чанарын баталгаажуулалтын алба",
]);
