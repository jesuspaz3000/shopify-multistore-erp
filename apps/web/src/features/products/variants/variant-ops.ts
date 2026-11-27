import type { InventoryPolicy, WeightUnit } from '@erp/contracts';

// Lógica pura de opciones y variantes, con el comportamiento del admin de Shopify:
// - Cada opción y cada valor tienen un uid estable: renombrar un valor NO cambia ni borra variantes.
// - Agregar un valor genera solo las combinaciones nuevas (las que contienen ese valor).
// - Agregar una opción aplica su primer valor (valor por defecto) a todas las variantes existentes.
// - Borrar un valor borra sus variantes; borrar una opción junta las variantes que quedan repetidas.
// - Las variantes que el usuario borró a mano no reaparecen solas.

export type VariantFields = {
  price: string;
  compareAtPrice: string;
  cost: string;
  taxable: boolean;
  sku: string;
  barcode: string;
  tracked: boolean;
  inventoryPolicy: InventoryPolicy;
  requiresShipping: boolean;
  weight: string;
  weightUnit: WeightUnit;
};

export type ValueDraft = { uid: string; name: string };
export type OptionDraft = { uid: string; name: string; values: ValueDraft[] };
export type VariantDraft = {
  uid: string;
  /** Variante ya guardada (se conserva al editar: mismo ítem de inventario). */
  id?: number;
  /** uid de opción -> uid de valor. */
  values: Record<string, string>;
  fields: VariantFields;
  /** Disponible total en bodegas (solo variantes guardadas; el stock se ajusta en Inventario). */
  available?: number;
};

let counter = 0;
export const newUid = (prefix = 'u') => `${prefix}${++counter}-${Math.random().toString(36).slice(2, 8)}`;

export const emptyFields = (): VariantFields => ({
  price: '',
  compareAtPrice: '',
  cost: '',
  taxable: true,
  sku: '',
  barcode: '',
  tracked: true,
  inventoryPolicy: 'DENY',
  requiresShipping: true,
  weight: '',
  weightUnit: 'KILOGRAMS',
});

/** Variante nueva a partir de otra: copia precios y envío, no identificadores (SKU, código de barras). */
const fromTemplate = (fields: VariantFields): VariantFields => ({ ...fields, sku: '', barcode: '' });

export const comboKey = (variant: VariantDraft, options: OptionDraft[]) => options.map((o) => variant.values[o.uid]).join('|');

/** "Rojo / M" */
export function variantLabel(variant: VariantDraft, options: OptionDraft[], skipOptionUid?: string): string {
  return options
    .filter((o) => o.uid !== skipOptionUid)
    .map((o) => o.values.find((v) => v.uid === variant.values[o.uid])?.name ?? '?')
    .join(' / ');
}

/** Combinaciones de uids de valores (producto cartesiano), en el orden de opciones y valores. */
export function combinations(options: OptionDraft[]): string[][] {
  return options.reduce<string[][]>((acc, o) => acc.flatMap((combo) => o.values.map((v) => [...combo, v.uid])), [[]]);
}

/** Ordena como Shopify: por la primera opción, luego la segunda... según el orden de los valores. */
export function sortVariants(variants: VariantDraft[], options: OptionDraft[]): VariantDraft[] {
  const rank = (v: VariantDraft) => options.map((o) => o.values.findIndex((x) => x.uid === v.values[o.uid]));
  return [...variants].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return 0;
  });
}

/**
 * Ajusta las variantes a un cambio de opciones (`prev` -> `next`). Ver reglas al inicio del archivo.
 * `next` debe tener opciones completas (nombre y al menos un valor).
 */
export function applyOptionChange(prev: OptionDraft[], next: OptionDraft[], variants: VariantDraft[]): VariantDraft[] {
  const prevValueUids = new Set(prev.flatMap((o) => o.values.map((v) => v.uid)));

  // 1. Adaptar las existentes: opción nueva -> valor por defecto; valor borrado -> fuera; opción borrada -> se ignora.
  let result = variants.flatMap((variant) => {
    const values: Record<string, string> = {};
    for (const option of next) {
      const current = variant.values[option.uid];
      if (current === undefined) values[option.uid] = option.values[0].uid;
      else if (option.values.some((v) => v.uid === current)) values[option.uid] = current;
      else return [];
    }
    return [{ ...variant, values }];
  });

  // 2. Sin repetidas (al borrar una opción, "Rojo / S" y "Rojo / M" pasan a ser "Rojo"): queda la primera.
  const seen = new Set<string>();
  result = result.filter((v) => {
    const key = comboKey(v, next);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 3. Generar las combinaciones que incluyen algún valor nuevo.
  for (const combo of combinations(next)) {
    if (seen.has(combo.join('|')) || combo.every((uid) => prevValueUids.has(uid))) continue;
    const values = Object.fromEntries(next.map((o, i) => [o.uid, combo[i]]));
    const template = closest(result, values);
    result.push({ uid: newUid('v'), values, fields: template ? fromTemplate(template.fields) : emptyFields() });
    seen.add(combo.join('|'));
  }

  if (result.length === 0 && next.length === 0) {
    result = [{ uid: newUid('v'), values: {}, fields: variants[0] ? variants[0].fields : emptyFields() }];
  }
  return sortVariants(result, next);
}

/** Variante que comparte más valores con `values` (para copiar su precio a una nueva). */
function closest(variants: VariantDraft[], values: Record<string, string>): VariantDraft | undefined {
  let best: VariantDraft | undefined;
  let bestScore = -1;
  for (const v of variants) {
    const score = Object.entries(values).filter(([o, val]) => v.values[o] === val).length;
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

/** Agrega una variante a mano (combinación elegida). null si ya existe. */
export function addVariant(variants: VariantDraft[], options: OptionDraft[], values: Record<string, string>): VariantDraft[] | null {
  const key = options.map((o) => values[o.uid]).join('|');
  if (variants.some((v) => comboKey(v, options) === key)) return null;
  const template = closest(variants, values);
  return sortVariants([...variants, { uid: newUid('v'), values, fields: template ? fromTemplate(template.fields) : emptyFields() }], options);
}

export type VariantGroup = { value: ValueDraft; variants: VariantDraft[] };

/** Variantes agrupadas por los valores de una opción (en el orden de esos valores). */
export function groupVariants(variants: VariantDraft[], option: OptionDraft): VariantGroup[] {
  return option.values
    .map((value) => ({ value, variants: variants.filter((v) => v.values[option.uid] === value.uid) }))
    .filter((g) => g.variants.length > 0);
}

/** Precio común de un grupo, o rango "10 – 20" si difieren. */
export function priceSummary(variants: VariantDraft[]): { common: string | null; range: string } {
  const prices = variants.map((v) => v.fields.price.trim()).filter(Boolean);
  const unique = [...new Set(prices)];
  if (unique.length === 1 && prices.length === variants.length) return { common: unique[0], range: unique[0] };
  const numbers = prices.map(Number).filter((n) => !Number.isNaN(n));
  if (numbers.length === 0) return { common: null, range: '' };
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  return { common: null, range: min === max ? String(min) : `${min} – ${max}` };
}

/** Ganancia y margen como en Shopify (precio - costo; ganancia / precio). */
export function profitAndMargin(price: string, cost: string): { profit: string; margin: string } | null {
  const p = Number(price);
  const c = Number(cost);
  if (!price.trim() || !cost.trim() || Number.isNaN(p) || Number.isNaN(c)) return null;
  const profit = p - c;
  return { profit: profit.toFixed(2), margin: p > 0 ? `${((profit / p) * 100).toFixed(1)} %` : '—' };
}
