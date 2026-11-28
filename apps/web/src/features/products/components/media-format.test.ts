import { describe, expect, it } from 'vitest';
import { formatBytes, mediaSummary } from './media-format';

describe('detalles de imagen', () => {
  it('tamaño en base 1000, como Shopify', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(96_400)).toBe('96 kB');
    expect(formatBytes(2_000_000)).toBe('2 MB');
    expect(formatBytes(1_250_000)).toBe('1.3 MB');
  });

  it('tipo · dimensiones · tamaño (sin dimensiones si no se conocen)', () => {
    expect(mediaSummary({ mimeType: 'image/jpeg', width: 1600, height: 1600, fileSize: 96_000 })).toBe('JPG · 1600 × 1600 · 96 kB');
    expect(mediaSummary({ mimeType: 'image/webp', width: null, height: null, fileSize: 800 })).toBe('WEBP · 800 B');
  });
});
