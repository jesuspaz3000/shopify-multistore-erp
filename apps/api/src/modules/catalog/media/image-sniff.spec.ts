import { sniffImage } from './image-sniff.js';

// Imágenes mínimas válidas construidas byte a byte.
function png(width: number, height: number): Buffer {
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12, 'latin1');
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

function jpeg(width: number, height: number): Buffer {
  return Buffer.from([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0 (longitud 4)
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, // SOF0
    0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
}

function gif(width: number, height: number): Buffer {
  const buf = Buffer.alloc(13);
  buf.write('GIF89a', 0, 'latin1');
  buf.writeUInt16LE(width, 6);
  buf.writeUInt16LE(height, 8);
  return buf;
}

function webpVp8x(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);
  buf.write('RIFF', 0, 'latin1');
  buf.write('WEBP', 8, 'latin1');
  buf.write('VP8X', 12, 'latin1');
  buf.writeUIntLE(width - 1, 24, 3);
  buf.writeUIntLE(height - 1, 27, 3);
  return buf;
}

describe('sniffImage', () => {
  it('reconoce PNG, JPEG, GIF y WebP y lee sus dimensiones', () => {
    expect(sniffImage(png(640, 480))).toEqual({ mimeType: 'image/png', ext: 'png', width: 640, height: 480 });
    expect(sniffImage(jpeg(1200, 800))).toEqual({ mimeType: 'image/jpeg', ext: 'jpg', width: 1200, height: 800 });
    expect(sniffImage(gif(32, 16))).toEqual({ mimeType: 'image/gif', ext: 'gif', width: 32, height: 16 });
    expect(sniffImage(webpVp8x(2048, 1536))).toEqual({ mimeType: 'image/webp', ext: 'webp', width: 2048, height: 1536 });
  });

  it('rechaza lo que no es una imagen aunque se llame .jpg (HTML, SVG, texto, PDF)', () => {
    for (const text of ['<html><script>alert(1)</script></html>', '<svg xmlns="http://www.w3.org/2000/svg"></svg>', 'hola mundo, no soy una imagen', '%PDF-1.7 ...........']) {
      expect(sniffImage(Buffer.from(text))).toBeNull();
    }
    expect(sniffImage(Buffer.alloc(4))).toBeNull();
  });
});
