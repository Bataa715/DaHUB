/** Мэдлэгийн зураг — жагсаалт/ном үзэлтэд хангалттай чанар, жижиг payload */
export const KNOWLEDGE_IMAGE_MAX_W = 1400;
export const KNOWLEDGE_IMAGE_MAX_H = 1400;
export const KNOWLEDGE_IMAGE_QUALITY = 0.82;
export const KNOWLEDGE_MAX_IMAGES = 5;

export function resizeKnowledgeImageToDataUrl(img: HTMLImageElement): string {
  const ratio = Math.min(
    KNOWLEDGE_IMAGE_MAX_W / img.width,
    KNOWLEDGE_IMAGE_MAX_H / img.height,
    1,
  );
  const width = Math.round(img.width * ratio);
  const height = Math.round(img.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return img.src;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const webp = canvas.toDataURL("image/webp", KNOWLEDGE_IMAGE_QUALITY);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/jpeg", KNOWLEDGE_IMAGE_QUALITY);
}

export function fileToKnowledgeDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => resolve(resizeKnowledgeImageToDataUrl(img));
      img.onerror = () => reject(new Error("image decode failed"));
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
