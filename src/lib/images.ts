export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];
export const IMAGE_MAX = 5 * 1024 * 1024;

/** Detects the real image type from the file's first bytes (never trust the browser's label). */
export function sniffImage(buf: Uint8Array): ImageType | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  return null;
}

export function extFor(type: ImageType) {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}
