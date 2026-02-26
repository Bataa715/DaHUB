export const DEPARTMENTS = [
  "Удирдлага",
  "Дата анализын алба",
  "Ерөнхий аудитын хэлтэс",
  "Зайны аудит чанарын баталгаажуулалтын хэлтэс",
  "Мэдээллийн технологийн аудитын хэлтэс",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

/** Department short-code used for generating user IDs.
 *  NOTE: Keep in sync with apps/backend/src/auth/auth.service.ts DEPARTMENT_CODES
 */
export const DEPARTMENT_CODES: Record<string, string> = {
  Удирдлага: "DAG",
  "Дата анализын алба": "DAA",
  "Ерөнхий аудитын хэлтэс": "EAH",
  "Зайны аудит чанарын баталгаажуулалтын хэлтэс": "ZAGCHBH",
  "Мэдээллийн технологийн аудитын хэлтэс": "MTAH",
};

// Position mapping for each department
export const DEPARTMENT_POSITIONS: Record<string, string[]> = {
  Удирдлага: ["Захирал"],
  "Дата анализын алба": ["Дата сайнтист", "Дата инженер", "Дата аналист"],
  "Ерөнхий аудитын хэлтэс": ["Хэлтсийн захирал", "Ахлах аудитор", "Аудитор"],
  "Зайны аудит чанарын баталгаажуулалтын хэлтэс": [
    "Хэлтсийн захирал",
    "Ахлах аудитор",
    "Аудитор",
  ],
  "Мэдээллийн технологийн аудитын хэлтэс": [
    "Хэлтсийн захирал",
    "Ахлах аудитор",
    "Аудитор",
  ],
};
