/**
 * Department codes used to generate user IDs.
 * Single source of truth — shared by auth.service.ts and users.service.ts.
 * [LOW-1] Previously duplicated in both services.
 */
export const DEPARTMENT_CODES: Record<string, string> = {
  Удирдлага: "DAG",
  "Дата анализын алба": "DAA",
  "Ерөнхий аудитын хэлтэс": "EAH",
  "Зайны аудит чанарын баталгаажуулалтын хэлтэс": "ZACHBH",
  "Мэдээллийн технологийн аудитын хэлтэс": "MTAH",
};
