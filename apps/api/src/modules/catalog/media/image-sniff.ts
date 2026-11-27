// Detecta el tipo REAL de una imagen por sus primeros bytes ("magic numbers") y lee sus dimensiones.
// El tipo que declara el navegador es solo una afirmación: un .jpg puede ser un HTML con script.

export type SniffedImage = { mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; ext: string; width: number | null; height: number | null };

const startsWith = (buf: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

export function sniffImage(buf: Buffer): SniffedImage | null {
  if (buf.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A; IHDR con ancho/alto (big-endian) en 16..23
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    const ok = buf.length >= 24;
    return { mimeType: 'image/png', ext: 'png', width: ok ? buf.readUInt32BE(16) : null, height: ok ? buf.readUInt32BE(20) : null };
  }

  // GIF: "GIF87a" / "GIF89a"; ancho/alto (little-endian) en 6..9
  if (buf.toString('latin1', 0, 6) === 'GIF87a' || buf.toString('latin1', 0, 6) === 'GIF89a') {
    return { mimeType: 'image/gif', ext: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }

  // WebP: "RIFF" .... "WEBP"
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    return { mimeType: 'image/webp', ext: 'webp', ...webpSize(buf) };
  }

  // JPEG: FF D8 FF; dimensiones en el primer segmento SOF
  if (startsWith(buf, [0xff, 0xd8, 0xff])) {
    return { mimeType: 'image/jpeg', ext: 'jpg', ...jpegSize(buf) };
  }

  return null;
}

function webpSize(buf: Buffer): { width: number | null; height: number | null } {
  if (buf.length < 30) return { width: null, height: null };
  const chunk = buf.toString('latin1', 12, 16);
  if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  return { width: null, height: null };
}

function jpegSize(buf: Buffer): { width: number | null; height: number | null } {
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) return { width: null, height: null };
    const marker = buf[offset + 1];
    // SOF0..SOF15 excepto DHT (C4), JPG (C8) y DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    offset += 2 + buf.readUInt16BE(offset + 2);
  }
  return { width: null, height: null };
}
