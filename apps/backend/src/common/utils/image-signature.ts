import { BadRequestException } from "@nestjs/common";

/**
 * Зургийн БОДИТ төрлийг эхний байтуудаас (magic bytes) тодорхойлно.
 *
 * ⚠️ Яагаад хэрэгтэй вэ: `multipart/form-data`-ийн `Content-Type` болон
 * `data:image/...;base64,` угтвар хоёулаа КЛИЕНТЭЭС ирдэг — халдагч дурын
 * агуулгыг "image/png" гэж зарлаад илгээж чадна. Өмнө нь зөвхөн зарласан
 * төрлийг шалгадаг байсан тул сервер дээр зураг биш файл хадгалагдах
 * боломжтой байв. Энд агуулгыг өөрийг нь шалгана.
 */
export type ImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

/** Дэмжигдэх зургийн төрлүүд (бусад газрын allowlist-тэй тохирно). */
export const ALLOWED_IMAGE_MIMES: ReadonlySet<string> = new Set<ImageMime>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Тухайн буферын бодит зургийн төрөл; танигдаагүй бол null. */
export function sniffImageMime(buf: Buffer): ImageMime | null {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }

  // GIF: "GIF87a" эсвэл "GIF89a"
  const head6 = buf.subarray(0, 6).toString("latin1");
  if (head6 === "GIF87a" || head6 === "GIF89a") {
    return "image/gif";
  }

  // WEBP: "RIFF" ....(4 байт урт).... "WEBP"
  if (
    buf.subarray(0, 4).toString("latin1") === "RIFF" &&
    buf.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * Буфер нь жинхэнэ зураг мөн эсэх, мөн зарласан төрөлтэйгээ тохирч байгааг
 * шалгана. Тохирохгүй бол 400 шидэнэ.
 *
 * `image/jpg` ба `image/jpeg` нь ижил гэж үзнэ (хөтчүүд хоёуланг илгээдэг).
 */
export function assertRealImage(buf: Buffer, declaredMime?: string): ImageMime {
  const actual = sniffImageMime(buf);
  if (!actual) {
    throw new BadRequestException(
      "Файлын агуулга зураг биш байна (jpg/png/webp/gif байх ёстой)",
    );
  }

  if (declaredMime) {
    const normalized =
      declaredMime.toLowerCase() === "image/jpg"
        ? "image/jpeg"
        : declaredMime.toLowerCase();
    if (normalized !== actual) {
      throw new BadRequestException(
        `Файлын агуулга зарласан төрөлтэй таарахгүй байна (зарласан: ${declaredMime}, бодит: ${actual})`,
      );
    }
  }

  return actual;
}
