import type { MediaDetailResponse } from "@erp/contracts";

const TYPE_LABEL: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/gif": "GIF",
  "image/webp": "WEBP",
};

/** 96 kB · 1.2 MB (base 1000, como Shopify). */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} kB`;
  return `${(bytes / 1_000_000).toFixed(1).replace(/\.0$/, "")} MB`;
}

export function mediaSummary(
  detail: Pick<
    MediaDetailResponse,
    "mimeType" | "width" | "height" | "fileSize"
  >,
): string {
  const parts = [TYPE_LABEL[detail.mimeType] ?? detail.mimeType];
  if (detail.width && detail.height)
    parts.push(`${detail.width} × ${detail.height}`);
  parts.push(formatBytes(detail.fileSize));
  return parts.join(" · ");
}
