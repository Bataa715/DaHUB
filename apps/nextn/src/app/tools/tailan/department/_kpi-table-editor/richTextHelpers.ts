import { RichTextItem, RichTextContent } from "../_types";

// ─── Unified content helpers ─────────────────────────────────────────────────
export function getItemContents(item: RichTextItem): RichTextContent[] {
  if (item.contents && item.contents.length > 0) return item.contents;
  // backward-compat: build from bullets + images
  const bc: RichTextContent[] = item.bullets.map((b, i) => ({
    id: `b_${i}_${item.id}`,
    type: "bullet" as const,
    text: b,
  }));
  const ic: RichTextContent[] = (item.images ?? []).map((img) => ({
    id: img.id,
    type: "image" as const,
    dataUrl: img.dataUrl,
    width: img.width,
  }));
  return [...bc, ...ic];
}
