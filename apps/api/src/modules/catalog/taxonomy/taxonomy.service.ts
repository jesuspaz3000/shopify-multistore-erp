import { BadRequestException, Injectable } from '@nestjs/common';
import type { TaxonomyCategoryResponse, TaxonomyQuery } from '@erp/contracts';
import { taxonomyCode, taxonomyGid } from './taxonomy-parser.js';
import { type TaxonomyRow, TaxonomyRepository } from './taxonomy.repository.js';

export const toCategoryResponse = (row: TaxonomyRow): TaxonomyCategoryResponse => ({
  id: taxonomyGid(row.id),
  name: row.name,
  fullName: row.fullName,
  isLeaf: row.isLeaf,
  level: row.level,
});

/** Categorías de producto: la taxonomía estándar de Shopify (la misma para todas las empresas). */
@Injectable()
export class TaxonomyService {
  constructor(private readonly repo: TaxonomyRepository) {}

  /** Con `q` busca; si no, lista las hijas de `parentId` (o las categorías raíz). */
  async list(query: TaxonomyQuery): Promise<TaxonomyCategoryResponse[]> {
    if (query.q && query.q.length >= 2) return (await this.repo.search(query.q)).map(toCategoryResponse);
    const parent = query.parentId ? taxonomyCode(query.parentId) : null;
    if (query.parentId && !parent) throw new BadRequestException('Categoría inválida');
    return (await this.repo.children(parent)).map(toCategoryResponse);
  }

  /** Categorías por GID (o código). Las que no existen no aparecen en el mapa. */
  async byIds(ids: string[]): Promise<Map<string, TaxonomyCategoryResponse>> {
    const codes = [...new Set(ids.map(taxonomyCode).filter((c): c is string => !!c))];
    const rows = await this.repo.findByIds(codes);
    return new Map([...rows.values()].map((r) => [taxonomyGid(r.id), toCategoryResponse(r)]));
  }

  /** Valida la categoría elegida para un producto y devuelve su GID (null = sin categoría). */
  async resolve(categoryId: string | null): Promise<string | null> {
    if (!categoryId) return null;
    const gid = taxonomyGid(taxonomyCode(categoryId) ?? '');
    const found = await this.byIds([gid]);
    if (!found.has(gid)) throw new BadRequestException('La categoría no existe en la taxonomía de Shopify');
    return gid;
  }
}
