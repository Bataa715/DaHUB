export const DEPARTMENTS = [
  "Удирдлага",
  "Дата анализын алба",
  "Бизнесийн аудитын хэлтэс",
  "Эрсдэл, комплаенс, санхүүгийн аудитын хэлтэс",
  "Мэдээллийн технологийн аудитын хэлтэс",
  "Чанарын баталгаажуулалтын алба",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

/** Department short-code used for generating user IDs.
 *  NOTE: Keep in sync with apps/backend/src/common/constants/departments.ts
 *  Бүртгэл: ихэнх нь DAG-{CODE}-Name (ж: DAG-DAA-Bat), CHBA л DAG-гүй.
 */
export const DEPARTMENT_CODES: Record<string, string> = {
  Удирдлага: "DAG",
  "Дата анализын алба": "DAA",
  "Бизнесийн аудитын хэлтэс": "BAH",
  // [BUG FIX] was previously keyed "Эрсдэл, Комплаенс ба Санхүүгийн аудитын
  // хэлтэс" (different casing/wording than the DEPARTMENTS array entry
  // below), so this lookup silently missed and fell back to "USR" for this
  // department. Must match the DEPARTMENTS spelling exactly.
  "Эрсдэл, комплаенс, санхүүгийн аудитын хэлтэс": "EKSAH",
  "Мэдээллийн технологийн аудитын хэлтэс": "MTAH",
  "Чанарын баталгаажуулалтын алба": "CHBA",
};

/**
 * Department order for the login page's department dropdown — deliberately
 * different from DEPARTMENTS' display order elsewhere (leadership first,
 * then БАХ, ЕКСАХ, МТАН, ДАА, ЧБА).
 */
export const LOGIN_DEPARTMENT_ORDER: readonly Department[] = [
  "Удирдлага",
  "Бизнесийн аудитын хэлтэс",
  "Эрсдэл, комплаенс, санхүүгийн аудитын хэлтэс",
  "Мэдээллийн технологийн аудитын хэлтэс",
  "Дата анализын алба",
  "Чанарын баталгаажуулалтын алба",
] as const;

/** DAG prefix авахгүй хэлтэс/алба (userId: CHBA-Name) */
export const NO_DAG_PREFIX_DEPARTMENTS = new Set([
  "Чанарын баталгаажуулалтын алба",
]);

/** Захирал албан тушаал / `.Name-…` director userId байхгүй алба */
export const NO_DIRECTOR_DEPARTMENTS = new Set([
  "Дата анализын алба",
  "Чанарын баталгаажуулалтын алба",
]);

// Position mapping for each department
export const DEPARTMENT_POSITIONS: Record<string, string[]> = {
  Удирдлага: ["Газрын захирал"],
  "Дата анализын алба": [
    "Ахлах дата аналист",
    "Дата инженер",
    "Дата аналист",
  ],
  "Бизнесийн аудитын хэлтэс": [
    "Хэлтсийн захирал",
    "Ахлах аудитор",
    "Аудитор",
  ],
  "Эрсдэл, комплаенс, санхүүгийн аудитын хэлтэс": [
    "Хэлтсийн захирал",
    "Ахлах аудитор",
    "Аудитор",
  ],
  "Мэдээллийн технологийн аудитын хэлтэс": [
    "Хэлтсийн захирал",
    "Ахлах аудитор",
    "Аудитор",
  ],
  "Чанарын баталгаажуулалтын алба": ["Аудитор"],
};
