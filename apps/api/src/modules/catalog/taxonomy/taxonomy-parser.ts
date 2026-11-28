// Lee categories.<locale>.txt de la taxonomía de Shopify:
//   # Shopify Product Taxonomy - Categories: 2026-11
//   gid://shopify/TaxonomyCategory/sg-4-17-2-17   : Artículos deportivos > ... > Tablas de snowboard
// El padre se deduce del código (sg-4-17-2-17 -> sg-4-17-2) y el nombre es lo que sigue a la ruta
// del padre (así un nombre con " > " no rompe nada).

export const TAXONOMY_GID_PREFIX = 'gid://shopify/TaxonomyCategory/';

export type TaxonomyEntry = {
  id: string;
  parentId: string | null;
  level: number;
  name: string;
  fullName: string;
  isLeaf: boolean;
  searchName: string;
  searchFullName: string;
};

/** Texto para buscar: minúsculas y sin tildes ("Esquí" -> "esqui"). */
export const searchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const LINE = /^gid:\/\/shopify\/TaxonomyCategory\/([a-z]{2}(?:-\d+)*)\s+:\s+(.+)$/;
const VERSION = /Categories:\s*(\S+)/;

/** gid://shopify/TaxonomyCategory/sg-4 o sg-4 -> "sg-4"; null si no es un código válido. */
export function taxonomyCode(value: string): string | null {
  const code = value.startsWith(TAXONOMY_GID_PREFIX) ? value.slice(TAXONOMY_GID_PREFIX.length) : value;
  return /^[a-z]{2}(-\d+)*$/.test(code) ? code : null;
}

export const taxonomyGid = (code: string) => `${TAXONOMY_GID_PREFIX}${code}`;

const parentOf = (code: string) => (code.includes('-') ? code.slice(0, code.lastIndexOf('-')) : null);

export function parseTaxonomy(text: string): { version: string | null; entries: TaxonomyEntry[] } {
  let version: string | null = null;
  const raw = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('#')) {
      version ??= VERSION.exec(line)?.[1] ?? null;
      continue;
    }
    const match = LINE.exec(line.trim());
    if (match) raw.set(match[1], match[2].trim());
  }

  const withChildren = new Set<string>();
  for (const code of raw.keys()) {
    const parent = parentOf(code);
    if (parent) withChildren.add(parent);
  }

  const entries: TaxonomyEntry[] = [];
  for (const [code, fullName] of raw) {
    const parentId = parentOf(code);
    const parentName = parentId ? raw.get(parentId) : undefined;
    if (parentId && !parentName) throw new Error(`La categoría ${code} no tiene su padre ${parentId} en el archivo`);
    const name = parentName && fullName.startsWith(`${parentName} > `) ? fullName.slice(parentName.length + 3) : fullName.split(' > ').pop()!;
    entries.push({
      id: code,
      parentId,
      level: code.split('-').length - 1,
      name,
      fullName,
      isLeaf: !withChildren.has(code),
      searchName: searchText(name),
      searchFullName: searchText(fullName),
    });
  }
  return { version, entries };
}
