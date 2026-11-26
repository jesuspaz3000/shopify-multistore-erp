import { nextAvailableSlug, RESERVED_SLUGS, slugify } from './slug.js';

describe('slugify', () => {
  it('quita tildes, símbolos y espacios', () => {
    expect(slugify('Tienda Ñandú & Cía.')).toBe('tienda-nandu-cia');
  });

  it('usa "empresa" cuando no queda nada útil', () => {
    expect(slugify('¡¡!!')).toBe('empresa');
  });

  it('limita el largo sin dejar guion al final', () => {
    const slug = slugify(`${'a'.repeat(49)} b`);
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('nextAvailableSlug', () => {
  it('devuelve la base si está libre', () => {
    expect(nextAvailableSlug('acme', new Set())).toBe('acme');
  });

  it('agrega sufijo numérico si está ocupada', () => {
    expect(nextAvailableSlug('acme', new Set(['acme', 'acme-2']))).toBe('acme-3');
  });

  it('nunca devuelve un slug reservado por las rutas', () => {
    for (const reserved of RESERVED_SLUGS) {
      expect(nextAvailableSlug(reserved, new Set())).toBe(`${reserved}-2`);
    }
  });
});
