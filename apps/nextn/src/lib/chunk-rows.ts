/**
 * Backend-ийн body хязгаар (1MB)-аас доогуур байхаар хэсэглэнэ.
 * Кирилл үсэг UTF-8-д 2 байт тул тэмдэгтээр биш байтаар тооцно.
 */
export function chunkRows<T>(
  rows: T[],
  maxBytes = 700_000,
  maxRows = 1000,
): T[][] {
  const encoder = new TextEncoder();
  const chunks: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const row of rows) {
    const size = encoder.encode(JSON.stringify(row)).length + 1;
    if (
      current.length &&
      (bytes + size > maxBytes || current.length >= maxRows)
    ) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(row);
    bytes += size;
  }
  if (current.length) chunks.push(current);
  return chunks;
}
