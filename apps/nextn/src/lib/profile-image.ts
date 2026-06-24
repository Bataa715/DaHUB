/** Hero portrait (~16.5rem×22rem) @ 3× retina */
export const PROFILE_IMAGE_MAX_W = 960;
export const PROFILE_IMAGE_MAX_H = 1280;
export const PROFILE_IMAGE_QUALITY = 0.92;

export function resizeProfileImageToDataUrl(img: HTMLImageElement): string {
  const ratio = Math.min(
    PROFILE_IMAGE_MAX_W / img.width,
    PROFILE_IMAGE_MAX_H / img.height,
    1,
  );
  const width = Math.round(img.width * ratio);
  const height = Math.round(img.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return img.src;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const webp = canvas.toDataURL("image/webp", PROFILE_IMAGE_QUALITY);
  if (webp.startsWith("data:image/webp")) {
    return webp;
  }

  return canvas.toDataURL("image/jpeg", PROFILE_IMAGE_QUALITY);
}
