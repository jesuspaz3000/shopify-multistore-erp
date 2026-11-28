import { describe, expect, it } from 'vitest';
import { parseTaxonomy, taxonomyCode, taxonomyGid } from './taxonomy-parser.js';

const SAMPLE = `# Shopify Product Taxonomy - Categories: 2026-11
# Format: {GID} : {Ancestor name} > ... > {Category name}

gid://shopify/TaxonomyCategory/sg                    : Artículos deportivos
gid://shopify/TaxonomyCategory/sg-4                  : Artículos deportivos > Deportes de invierno
gid://shopify/TaxonomyCategory/sg-4-17               : Artículos deportivos > Deportes de invierno > Esquí > snowboard
gid://shopify/TaxonomyCategory/sg-4-17-2             : Artículos deportivos > Deportes de invierno > Esquí > snowboard > Tablas
`;

describe('parseTaxonomy', () => {
  it('lee versión, jerarquía, nivel, hojas y nombres (aunque un nombre tenga " > ")', () => {
    const { version, entries: parsed } = parseTaxonomy(SAMPLE);
    expect(version).toBe('2026-11');
    expect(parsed[2]).toMatchObject({ searchName: 'esqui > snowboard' });
    const entries = parsed.map(({ searchName: _n, searchFullName: _f, ...rest }) => rest);
    expect(entries).toEqual([
      { id: 'sg', parentId: null, level: 0, name: 'Artículos deportivos', fullName: 'Artículos deportivos', isLeaf: false },
      { id: 'sg-4', parentId: 'sg', level: 1, name: 'Deportes de invierno', fullName: 'Artículos deportivos > Deportes de invierno', isLeaf: false },
      { id: 'sg-4-17', parentId: 'sg-4', level: 2, name: 'Esquí > snowboard', fullName: 'Artículos deportivos > Deportes de invierno > Esquí > snowboard', isLeaf: false },
      {
        id: 'sg-4-17-2',
        parentId: 'sg-4-17',
        level: 3,
        name: 'Tablas',
        fullName: 'Artículos deportivos > Deportes de invierno > Esquí > snowboard > Tablas',
        isLeaf: true,
      },
    ]);
  });

  it('rechaza un archivo sin el padre de alguna categoría', () => {
    expect(() => parseTaxonomy('gid://shopify/TaxonomyCategory/sg-4 : A > B')).toThrow(/padre/);
  });

  it('códigos y GIDs', () => {
    expect(taxonomyCode('gid://shopify/TaxonomyCategory/sg-4-17')).toBe('sg-4-17');
    expect(taxonomyCode('sg-4')).toBe('sg-4');
    expect(taxonomyCode("sg-4'; drop table x")).toBeNull();
    expect(taxonomyCode('gid://shopify/Product/1')).toBeNull();
    expect(taxonomyGid('sg-4')).toBe('gid://shopify/TaxonomyCategory/sg-4');
  });
});
